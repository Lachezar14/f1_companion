import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Driver, Meeting, Session, SessionResult } from './types';

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

/**
 * Generate cache key from URL and params
 */
function getCacheKey(url: string, params?: any): string {
    return CACHE_PREFIX + url + (params ? JSON.stringify(params) : '');
}

/**
 * Read from AsyncStorage cache
 */
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

/**
 * Write to AsyncStorage cache
 */
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

/**
 * Check if cache entry is fresh (within TTL)
 */
function isCacheFresh(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Check if cache entry is stale but usable (within extended TTL)
 */
function isCacheStale(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp;
    return age >= CACHE_TTL && age < STALE_CACHE_TTL;
}

/* =========================
   CORE API FUNCTION
========================= */

interface CachedGetOptions {
    maxRetries?: number;
    retryDelay?: number;
    useStaleOnError?: boolean;
}

/**
 * Cached GET request with retry logic and error handling
 */
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
                        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
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
   API FUNCTIONS
========================= */

/**
 * Get all meetings (GPs) for a given year
 */
export async function getMeetingsByYear(year: number): Promise<Meeting[]> {
    return cachedGet<Meeting[]>('/meetings', { year });
}

/**
 * Get sessions for a meeting, optionally filtered by type
 */
export async function getSessionsByMeeting(
    meetingKey: number,
    type?: 'Qualifying' | 'Race'
): Promise<Session[]> {
    const sessions = await cachedGet<Session[]>('/sessions', {
        meeting_key: meetingKey,
    });

    if (type) {
        return sessions.filter(s => s.session_name === type);
    }

    return sessions;
}

/**
 * Get driver info by session and driver number
 */
export async function getDriver(
    sessionKey: number,
    driverNumber: number
): Promise<Driver | null> {
    const drivers = await cachedGet<Driver[]>('/drivers', {
        session_key: sessionKey,
        driver_number: driverNumber,
    });
    return drivers[0] || null;
}

/**
 * Get all drivers for a session
 */
export async function getDriversBySession(sessionKey: number): Promise<Driver[]> {
    return cachedGet<Driver[]>('/drivers', { session_key: sessionKey });
}

/**
 * Get session results
 */
export async function getSessionResults(sessionKey: number): Promise<SessionResult[]> {
    return cachedGet<SessionResult[]>('/session_result', {
        session_key: sessionKey,
    });
}

/* =========================
   COMPOSITE DATA FETCHERS
========================= */

export interface PoleSitter {
    driver: string;
    constructor: string;
    fastestLap: string | null;
}

/**
 * Get pole sitter info for a meeting
 * Returns null if data is unavailable
 */
export async function getPoleSitterByMeeting(
    meetingKey: number
): Promise<PoleSitter | null> {
    try {
        // Get qualifying session
        const qualifyingSessions = await getSessionsByMeeting(meetingKey, 'Qualifying');
        if (!qualifyingSessions.length) {
            console.log(`[POLE] No qualifying session found for meeting ${meetingKey}`);
            return null;
        }

        const session = qualifyingSessions[0];

        // Fetch results and drivers in parallel
        const [results, drivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySession(session.session_key),
        ]);

        // Find pole position (position 1)
        const poleResult = results.find(r => r.position === 1);
        if (!poleResult) {
            console.log(`[POLE] No P1 result found for session ${session.session_key}`);
            return null;
        }

        // Find driver info
        const driver = drivers.find(d => d.driver_number === poleResult.driver_number);
        if (!driver) {
            console.log(
                `[POLE] Driver ${poleResult.driver_number} not found in session ${session.session_key}`
            );
            return null;
        }

        return {
            driver: driver.full_name,
            constructor: driver.team_name,
            fastestLap: normalizeDuration(poleResult.duration),
        };
    } catch (error) {
        console.error(`[POLE] Error fetching pole sitter for meeting ${meetingKey}:`, error);
        return null;
    }
}

export interface PodiumFinisher {
    position: number;
    driver: string;
    constructor: string;
    time: string | null;
}

/**
 * Get top 3 race results for a meeting
 * Returns empty array if data is unavailable
 */
export async function getRacePodiumByMeeting(
    meetingKey: number
): Promise<PodiumFinisher[]> {
    try {
        // Get race session
        const raceSessions = await getSessionsByMeeting(meetingKey, 'Race');
        if (!raceSessions.length) {
            console.log(`[PODIUM] No race session found for meeting ${meetingKey}`);
            return [];
        }

        const session = raceSessions[0];

        // Fetch results and drivers in parallel
        const [results, drivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySession(session.session_key),
        ]);

        // Create driver lookup map
        const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

        // Filter top 3 and map to podium finishers
        const podium = results
            .filter(r => r.position && r.position <= 3)
            .sort((a, b) => a.position - b.position)
            .map(r => {
                const driver = driverMap.get(r.driver_number);
                if (!driver) {
                    console.warn(
                        `[PODIUM] Driver ${r.driver_number} not found for position ${r.position}`
                    );
                    return null;
                }

                return {
                    position: r.position,
                    driver: driver.full_name,
                    constructor: driver.team_name,
                    time:
                        r.position === 1
                            ? normalizeDuration(r.duration)
                            : r.gap_to_leader || null,
                };
            })
            .filter((p): p is PodiumFinisher => p !== null);

        return podium;
    } catch (error) {
        console.error(`[PODIUM] Error fetching podium for meeting ${meetingKey}:`, error);
        return [];
    }
}

/* =========================
   FORMATTING UTILITIES
========================= */

/**
 * Convert seconds to HH:MM:SS format
 */
export function formatRaceTime(seconds: number | null | undefined): string {
    if (seconds == null) return '-';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hh = hrs.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

/**
 * Convert seconds to MM:SS.mmm format
 */
export function formatLapTime(seconds: number | null | undefined): string {
    if (seconds == null) return '-';

    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);

    return `${minutes}:${secs.padStart(6, '0')}`;
}

/**
 * Normalize duration from SessionResult
 * - For qualifying: takes fastest of Q1/Q2/Q3 → MM:SS.mmm
 * - For race: converts total seconds to HH:MM:SS
 */
export function normalizeDuration(
    duration: number | number[] | null | undefined
): string | null {
    if (!duration) return null;

    if (Array.isArray(duration)) {
        // Qualifying: fastest lap from Q1/Q2/Q3
        const validLaps = duration.filter(d => d != null && d > 0);
        if (!validLaps.length) return null;

        const fastest = Math.min(...validLaps);
        return formatLapTime(fastest);
    } else {
        // Race: total duration
        return formatRaceTime(duration);
    }
}

/* =========================
   CACHE MANAGEMENT
========================= */

/**
 * Clear all cached data
 */
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

/**
 * Clear cache for a specific endpoint
 */
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