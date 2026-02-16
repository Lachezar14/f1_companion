import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
    Driver,
    Lap,
    Meeting,
    Session,
    SessionResult,
    Stint,
    StartingGrid,
    Overtake,
    Weather, ChampionshipDriver, ChampionshipTeam, PitStop
} from '../types';

const openF1 = axios.create({
    baseURL: 'https://api.openf1.org/v1',
    timeout: 20000,
});

/* =========================
   CONCURRENCY QUEUE
========================= */
const MAX_CONCURRENT = 3;
const MAX_REQUESTS_PER_SECOND = 3;
const MAX_REQUESTS_PER_MINUTE = 30;
const SECOND_MS = 1000;
const MINUTE_MS = 60 * 1000;
const RATE_WAIT_FLOOR_MS = 50;

let activeRequests = 0;
const queue: (() => void)[] = [];
const secondWindowTimestamps: number[] = [];
const minuteWindowTimestamps: number[] = [];

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

function pruneWindow(timestamps: number[], maxAgeMs: number, now: number): void {
    while (timestamps.length && now - timestamps[0] >= maxAgeMs) {
        timestamps.shift();
    }
}

async function waitForRateLimitSlot(): Promise<void> {
    while (true) {
        const now = Date.now();
        pruneWindow(secondWindowTimestamps, SECOND_MS, now);
        pruneWindow(minuteWindowTimestamps, MINUTE_MS, now);

        const underPerSecondLimit = secondWindowTimestamps.length < MAX_REQUESTS_PER_SECOND;
        const underPerMinuteLimit = minuteWindowTimestamps.length < MAX_REQUESTS_PER_MINUTE;

        if (underPerSecondLimit && underPerMinuteLimit) {
            secondWindowTimestamps.push(now);
            minuteWindowTimestamps.push(now);
            return;
        }

        const waitForSecond =
            !underPerSecondLimit && secondWindowTimestamps.length
                ? SECOND_MS - (now - secondWindowTimestamps[0])
                : 0;
        const waitForMinute =
            !underPerMinuteLimit && minuteWindowTimestamps.length
                ? MINUTE_MS - (now - minuteWindowTimestamps[0])
                : 0;
        const waitMs = Math.max(waitForSecond, waitForMinute, RATE_WAIT_FLOOR_MS);

        await sleep(waitMs);
    }
}

async function runWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (activeRequests >= MAX_CONCURRENT) {
        await new Promise<void>(resolve => queue.push(resolve));
    }

    activeRequests++;

    try {
        await waitForRateLimitSlot();
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
const DEFAULT_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const DEFAULT_STALE_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours (for fallback)
const MEMORY_CACHE_MAX_ENTRIES = 200;
const CACHE_TTL_BY_ENDPOINT: Record<string, number> = {
    '/meetings': 1000 * 60 * 60 * 6, // 6 hours
    '/sessions': 1000 * 60 * 60 * 6, // 6 hours
    '/drivers': 1000 * 60 * 60 * 2, // 2 hours
    '/session_result': 1000 * 60 * 30, // 30 minutes
    '/laps': 1000 * 60 * 30, // 30 minutes
    '/stints': 1000 * 60 * 30, // 30 minutes
    '/overtakes': 1000 * 60 * 15, // 15 minutes
    '/pit': 1000 * 60 * 15, // 15 minutes
    '/race_control': 1000 * 60 * 2, // 2 minutes
    '/weather': 1000 * 60 * 2, // 2 minutes
    '/starting_grid': 1000 * 60 * 60 * 24, // 24 hours
    '/championship_drivers': 1000 * 60 * 5, // 5 minutes
    '/championship_teams': 1000 * 60 * 5, // 5 minutes
};

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// Track inflight requests to prevent duplicates
const inflightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<string, CacheEntry<any>>();

function getCacheKey(url: string, params?: any): string {
    return CACHE_PREFIX + url + (params ? JSON.stringify(params) : '');
}

async function readCache<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
    const inMemoryEntry = memoryCache.get(cacheKey);
    if (inMemoryEntry) {
        // Touch entry for LRU behavior.
        memoryCache.delete(cacheKey);
        memoryCache.set(cacheKey, inMemoryEntry);
        return inMemoryEntry as CacheEntry<T>;
    }

    try {
        const cachedString = await AsyncStorage.getItem(cacheKey);
        if (!cachedString) return null;
        const entry = JSON.parse(cachedString) as CacheEntry<T>;
        memoryCache.delete(cacheKey);
        memoryCache.set(cacheKey, entry);
        if (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
            const oldestKey = memoryCache.keys().next().value;
            if (typeof oldestKey === 'string') {
                memoryCache.delete(oldestKey);
            }
        }
        return entry;
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
        memoryCache.delete(cacheKey);
        memoryCache.set(cacheKey, entry);
        if (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
            const oldestKey = memoryCache.keys().next().value;
            if (typeof oldestKey === 'string') {
                memoryCache.delete(oldestKey);
            }
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
        console.warn(`[CACHE WRITE ERROR] ${cacheKey}:`, error);
    }
}

function resolveCacheTtl(url: string): number {
    return CACHE_TTL_BY_ENDPOINT[url] ?? DEFAULT_CACHE_TTL;
}

function resolveStaleCacheTtl(cacheTtl: number): number {
    return Math.max(DEFAULT_STALE_CACHE_TTL, cacheTtl * 2);
}

function isCacheFresh(entry: CacheEntry<any>, cacheTtl: number): boolean {
    return Date.now() - entry.timestamp < cacheTtl;
}

function isCacheStale(entry: CacheEntry<any>, cacheTtl: number, staleCacheTtl: number): boolean {
    const age = Date.now() - entry.timestamp;
    return age >= cacheTtl && age < staleCacheTtl;
}

/* =========================
   CACHE MANAGEMENT
========================= */

export async function clearCache(): Promise<void> {
    try {
        memoryCache.clear();
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
        Array.from(memoryCache.keys()).forEach(key => {
            if (key.startsWith(CACHE_PREFIX + url)) {
                memoryCache.delete(key);
            }
        });
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

function parseRetryAfterMs(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value * 1000);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
        return Math.max(0, asNumber * 1000);
    }

    const asDate = Date.parse(value);
    if (Number.isNaN(asDate)) {
        return null;
    }

    return Math.max(0, asDate - Date.now());
}

function resolveRetryDelay(error: unknown, baseDelayMs: number): number {
    if (!axios.isAxiosError(error)) {
        return baseDelayMs;
    }

    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterValue = Array.isArray(retryAfterHeader)
        ? retryAfterHeader[0]
        : retryAfterHeader;
    const retryAfterMs = parseRetryAfterMs(retryAfterValue);

    return retryAfterMs == null ? baseDelayMs : Math.max(baseDelayMs, retryAfterMs);
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
    const cacheTtl = resolveCacheTtl(url);
    const staleCacheTtl = resolveStaleCacheTtl(cacheTtl);

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
            if (cached && isCacheFresh(cached, cacheTtl)) {
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
                        const baseDelay = retryDelay * Math.pow(2, attempt);
                        const delay = resolveRetryDelay(error, baseDelay);
                        console.log(
                            `[RETRY] ${url} | attempt ${attempt + 1}/${maxRetries} | waiting ${delay}ms`
                        );
                        await sleep(delay);
                    }
                }
            }

            // 3. All retries failed
            console.error(
                `[API FAILED] ${url} after ${maxRetries} retries | params: ${JSON.stringify(params)}`,
                lastError
            );

            // 4. Try to use stale cache as fallback
            if (useStaleOnError && cached && isCacheStale(cached, cacheTtl, staleCacheTtl)) {
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

/**
 * Get session by key
 */
export async function fetchSessionByKey(sessionKey: number): Promise<Session | null> {
    const sessions = await cachedGet<Session[]>('/sessions', { session_key: sessionKey });
    return sessions[0] ?? null;
}

/**
 * Get all sessions for a meeting
 */
export async function fetchSessionsByYear(year: number): Promise<Session[]> {
    return cachedGet<Session[]>('/sessions', { year: year });
}

/**
 * Get all race sessions for a year
 */
export async function fetchRaceSessionsByYear(year: number): Promise<Session[]> {
    return cachedGet<Session[]>('/sessions', { session_name: 'Race', year: year });
}

/**
 * Get all qualifying sessions for a year
 */
export async function fetchQualifyingSessionsByYear(year: number): Promise<Session[]> {
    return cachedGet<Session[]>('/sessions', { session_name: 'Qualifying', year: year });
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

/**
 * Get all session results for driver
 */
export async function fetchSessionResultsByDriver(driverNumber: number): Promise<SessionResult[]> {
    return cachedGet<SessionResult[]>('/session_result', { driver_number: driverNumber });
}

export type SessionResultFilters = {
    driver_number?: number;
    session_key?: number;
    meeting_key?: number;
    session_type?: string;
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

/* =========================
   Race Control
========================= */

export type RawRaceControl = {
    category: string;
    date: string;
    driver_number?: number | null;
    flag?: string | null;
    lap_number?: number | null;
    meeting_key: number;
    session_key: number;
    message: string;
    qualifying_phase?: number | null;
    scope?: string | null;
    sector?: number | null;
};

/**
 * Get race control messages for a session
 */
export async function fetchRaceControlBySession(
    sessionKey: number
): Promise<RawRaceControl[]> {
    return cachedGet<RawRaceControl[]>('/race_control', {
        session_key: sessionKey,
    });
}

/* =========================
   Overtakes
========================= */

type RawOvertake = {
    date: string;
    meeting_key: number;
    overtaken_driver_number: number;
    overtaking_driver_number: number;
    position: number;
    session_key: number;
};

const normalizeOvertake = (raw: RawOvertake): Overtake => ({
    date: raw.date,
    meetingKey: raw.meeting_key,
    overtakenDriverNumber: raw.overtaken_driver_number,
    overtakingDriverNumber: raw.overtaking_driver_number,
    position: raw.position,
    sessionKey: raw.session_key,
});

/**
 * Get all overtakes for a session
 */
export async function fetchOvertakesBySession(
    sessionKey: number
): Promise<Overtake[]> {
    const data = await cachedGet<RawOvertake[]>('/overtakes', {
        session_key: sessionKey,
    });
    return data.map(normalizeOvertake);
}

/* =========================
   Pit
========================= */

/**
 * Get pit stops per session
 */
export async function fetchSessionPits(sessionKey: number): Promise<PitStop[]> {
    return cachedGet<PitStop[]>('/pit', {
        session_key: sessionKey,
    });
}


/* =========================
   Starting Grid
========================= */

/**
 * Get race starting grid for a race
 */
export async function fetchStartingGridByMeeting(meetingKey: number): Promise<StartingGrid[]> {
    return cachedGet<StartingGrid[]>('/starting_grid', {
        meeting_key: meetingKey,
    });
}

/* =========================
   Drivers Championship
========================= */

/**
 * Get championship driver standing
 */
export async function fetchDriverStanding(): Promise<ChampionshipDriver[]> {
    return cachedGet<ChampionshipDriver[]>('/championship_drivers', {
        session_key: 'latest',
    });
}


/* =========================
   Teams Championship
========================= */

/**
 * Get championship driver standing
 */
export async function fetchTeamStanding(): Promise<ChampionshipTeam[]> {
    return cachedGet<ChampionshipTeam[]>('/championship_teams', {
        session_key: 'latest',
    });
}


/* =========================
   Weather
========================= */

/**
 * Get weather data for a session
 */
export async function fetchWeatherBySession(
    sessionKey: number
): Promise<Weather[]> {
    return cachedGet<Weather[]>('/weather', {
        session_key: sessionKey,
    });
}
