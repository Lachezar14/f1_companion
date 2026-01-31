import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {Driver, Lap, Meeting, Session, SessionResult, Stint, StartingGrid} from '../types';

const openF1 = axios.create({
    baseURL: 'https://api.openf1.org/v1',
    timeout: 20000,
});

/* =========================
   CONCURRENCY QUEUE
========================= */
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const queue: (() => void)[] = [];

async function runWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (activeRequests >= MAX_CONCURRENT) {
        await new Promise<void>(resolve => queue.push(resolve));
    }

    activeRequests++;

    try {
        return await fn();
    } finally {
        activeRequests--;
        const next = queue.shift();
        if (next) next();
    }
}

/* =========================
   CACHE SYSTEM
========================= */
const CACHE_PREFIX = 'openf1_cache_';
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const STALE_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours (for fallback)

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// Track inflight requests to prevent duplicates
const inflightRequests = new Map<string, Promise<any>>();

function getCacheKey(url: string, params?: any): string {
    return CACHE_PREFIX + url + (params ? JSON.stringify(params) : '');
}

async function readCache<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
    try {
        const cachedString = await AsyncStorage.getItem(cacheKey);
        if (!cachedString) return null;
        return JSON.parse(cachedString) as CacheEntry<T>;
    } catch (error) {
        console.warn(`[CACHE READ ERROR] ${cacheKey}:`, error);
        return null;
    }
}

async function writeCache<T>(cacheKey: string, data: T): Promise<void> {
    try {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
        console.warn(`[CACHE WRITE ERROR] ${cacheKey}:`, error);
    }
}

function isCacheFresh(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < CACHE_TTL;
}

function isCacheStale(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp;
    return age >= CACHE_TTL && age < STALE_CACHE_TTL;
}

/* =========================
   CACHE MANAGEMENT
========================= */

export async function clearCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[CACHE] Cleared ${cacheKeys.length} entries`);
    } catch (error) {
        console.error('[CACHE] Error clearing cache:', error);
    }
}

export async function clearCacheForEndpoint(url: string): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX + url));
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[CACHE] Cleared ${cacheKeys.length} entries for ${url}`);
    } catch (error) {
        console.error(`[CACHE] Error clearing cache for ${url}:`, error);
    }
}

/* =========================
   CORE API FUNCTION
========================= */

interface CachedGetOptions {
    maxRetries?: number;
    retryDelay?: number;
    useStaleOnError?: boolean;
}

async function cachedGet<T>(
    url: string,
    params?: any,
    options: CachedGetOptions = {}
): Promise<T> {
    const {
        maxRetries = 2,
        retryDelay = 1000,
        useStaleOnError = true,
    } = options;

    const cacheKey = getCacheKey(url, params);

    // Check if there's already an inflight request for this exact resource
    if (inflightRequests.has(cacheKey)) {
        console.log(`[INFLIGHT] Reusing existing request for ${url}`);
        return inflightRequests.get(cacheKey)! as Promise<T>;
    }

    // Create the request promise
    const requestPromise = (async (): Promise<T> => {
        try {
            // 1. Check cache first
            const cached = await readCache<T>(cacheKey);
            if (cached && isCacheFresh(cached)) {
                console.log(`[CACHE HIT] ${url} | params: ${JSON.stringify(params)}`);
                return cached.data;
            }

            // Cache is stale or missing - fetch from API
            console.log(`[CACHE MISS] ${url} | params: ${JSON.stringify(params)}`);

            // 2. Attempt API call with retries
            let lastError: any;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const response = await runWithLimit(() =>
                        openF1.get<T>(url, { params })
                    );

                    console.log(`[API SUCCESS] ${url} | params: ${JSON.stringify(params)}`);

                    // Cache the successful response
                    await writeCache(cacheKey, response.data);

                    return response.data;
                } catch (error) {
                    lastError = error;

                    if (attempt < maxRetries) {
                        const delay = retryDelay * Math.pow(2, attempt);
                        console.log(
                            `[RETRY] ${url} | attempt ${attempt + 1}/${maxRetries} | waiting ${delay}ms`
                        );
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // 3. All retries failed
            console.error(
                `[API FAILED] ${url} after ${maxRetries} retries | params: ${JSON.stringify(params)}`,
                lastError
            );

            // 4. Try to use stale cache as fallback
            if (useStaleOnError && cached && isCacheStale(cached)) {
                console.log(
                    `[STALE CACHE FALLBACK] ${url} | age: ${Math.round((Date.now() - cached.timestamp) / 60000)}min`
                );
                return cached.data;
            }

            // 5. No fallback available - throw the error
            throw lastError;
        } finally {
            // Always clean up inflight tracking when done
            inflightRequests.delete(cacheKey);
        }
    })();

    // Track this request to prevent duplicates
    inflightRequests.set(cacheKey, requestPromise);

    return requestPromise;
}

/* =========================
   LOW-LEVEL API FUNCTIONS
   These are thin wrappers around HTTP calls
========================= */

/* =========================
   Meetings
========================= */

/**
 * Get all meetings (GPs) for a given year
 */
export async function fetchMeetingsByYear(year: number): Promise<Meeting[]> {
    return cachedGet<Meeting[]>('/meetings', { year });
}

/**
 * Get meeting by meeting key
 */
export async function fetchMeetingsByKey(meetingKey: number): Promise<Meeting[]> {
    return cachedGet<Meeting[]>('/meetings', { meeting_key: meetingKey });
}

/* =========================
   Sessions
========================= */

/**
 * Get all sessions for a meeting
 */
export async function fetchSessionsByMeeting(meetingKey: number): Promise<Session[]> {
    return cachedGet<Session[]>('/sessions', { meeting_key: meetingKey });
}

/* =========================
   Drivers
========================= */

/**
 * Get all drivers in a session
 */
export async function fetchDriversBySession(
    sessionKey: number
): Promise<Driver[]> {
    return cachedGet<Driver[]>('/drivers', { session_key: sessionKey });
}

/**
 * Get all drivers for a meeting
 */
export async function fetchDriversByMeetingKey(meetingKey: number): Promise<Driver[]> {
    return cachedGet<Driver[]>('/drivers', { meeting_key: meetingKey });
}

/* =========================
   Session Results
========================= */

/**
 * Get session results
 */
export async function fetchSessionResults(sessionKey: number): Promise<SessionResult[]> {
    return cachedGet<SessionResult[]>('/session_result', { session_key: sessionKey });
}

export type SessionResultFilters = {
    driver_number?: number;
    session_key?: number;
    meeting_key?: number;
    session_type?: string;
    year?: number;
    limit?: number;
};

/**
 * Get session results using flexible filters
 */
export async function fetchSessionResultsByFilters(
    filters: SessionResultFilters
): Promise<SessionResult[]> {
    const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined && value !== null)
    );
    return cachedGet<SessionResult[]>('/session_result', params);
}

/* =========================
   Stints
========================= */

/**
 * Get all stints for a session
 */
export async function fetchStintsBySession(
    sessionKey: number
): Promise<Stint[]> {
    return cachedGet<Stint[]>('/stints', {
        session_key: sessionKey,
    });
}

/**
 * Get all stints for a driver in a session
 */
export async function fetchStintsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Stint[]> {
    return cachedGet<Stint[]>('/stints', {
        session_key: sessionKey,
        driver_number: driverNumber,
    });
}

/* =========================
   Laps
========================= */

/**
 * Get all laps for a driver in a session
 */
export async function fetchLapsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Lap[]> {
    return cachedGet<Lap[]>('/laps', {
        session_key: sessionKey,
        driver_number: driverNumber,
    });
}

/**
 * Get all laps for a session
 */
export async function fetchLapsBySession(
    sessionKey: number
): Promise<Lap[]> {
    return cachedGet<Lap[]>('/laps', {
        session_key: sessionKey,
    });
}

/* =========================
   Car Data
========================= */

/**
 * Get telemetry / car data for a driver in a session
 */
export async function fetchCarDataByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<any[]> {
    return cachedGet<any[]>('/car_data', {
        session_key: sessionKey,
        driver_number: driverNumber,
    });
}

/* =========================
   Starting Grid
========================= */

/**
 * Get starting grid positions for a session
 */
export async function fetchStartingGridBySession(
    sessionKey: number
): Promise<StartingGrid[]> {
    return cachedGet<StartingGrid[]>('/starting_grid', {
        session_key: sessionKey,
    });
}
