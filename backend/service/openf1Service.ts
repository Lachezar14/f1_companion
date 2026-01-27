import {
    fetchDriversBySession,
    fetchLapsByDriverAndSession,
    fetchMeetingsByYear,
    fetchSessionResults,
    fetchSessionsByMeeting,
    fetchStintsByDriverAndSession,
    fetchSessionStartingGrid,
} from '../api/openf1';
import {Driver, Lap, Meeting, Session, SessionResult, StartingGrid, Stint} from '../types';

/* =========================
   TYPE DEFINITIONS
========================= */

export type PoleSitter = {
    driver: string;
    constructor: string;
    fastestLap: string | null;
};

export type PodiumFinisher = {
    position: number;
    driver: string;
    constructor: string;
    time: string | null;
};

export type GPDetails = {
    meeting: Meeting;
    pole: PoleSitter | null;
    podium: PodiumFinisher[];
    drivers: Driver[];
};

export type PartialErrors = {
    pole?: string;
    podium?: string;
    drivers?: string;
};

export type GPDetailsResult = {
    data: GPDetails | null;
    partialErrors: PartialErrors;
    error: string | null;
};

export type DriverRaceOverview = {
    driver: {
        number: number;
        name: string;
        team: string;
    };
    stints: Stint[];
    laps: Lap[];
    lap_count: number;
    stint_count: number;
};


/* =========================
   FORMATTING UTILITIES
========================= */

/**
 * Convert seconds to HH:MM:SS format
 */
function formatRaceTime(seconds: number | null | undefined): string {
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

function formatLapDuration(seconds: number | null | undefined): string | null {
    if (seconds == null) return null;
    return formatLapTime(seconds);
}

/**
 * Normalize duration from SessionResult
 * - For qualifying: takes fastest of Q1/Q2/Q3 → MM:SS.mmm
 * - For race: converts total seconds to HH:MM:SS
 */
function normalizeDuration(
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
   SERVICE FUNCTIONS
========================= */

/**
 * Get result for a session
 */
export async function getSessionResult(sessionKey: number): Promise<SessionResult[] | null> {
    try {
        return await fetchSessionResults(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get driver result for a session
 */
export async function getDriverSessionResult(sessionKey: number, driverNumber: number): Promise<SessionResult | null> {
    try {
        const sessionResult = await fetchSessionResults(sessionKey);
        return sessionStorage.find(s => s.driver_number === driverNumber) || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get session starting grid
 */
export async function getSessionStartingGrid(sessionKey: number): Promise<StartingGrid[] | null> {
    try {
        return await fetchSessionStartingGrid(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get driver result for a session
 */
export async function getDriverSessionStartingGrid(sessionKey: number, driverNumber: number): Promise<StartingGrid | null> {
    try {
        const startingGrid =  await fetchSessionStartingGrid(sessionKey);
        return startingGrid.find(s => s.driver_number === driverNumber) || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get qualifying session for a meeting
 */
export async function getQualifyingSession(meetingKey: number): Promise<Session | null> {
    try {
        const sessions = await fetchSessionsByMeeting(meetingKey);
        return sessions.find(s => s.session_name === 'Qualifying') || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get race session for a meeting
 */
export async function getRaceSession(meetingKey: number): Promise<Session | null> {
    try {
        const sessions = await fetchSessionsByMeeting(meetingKey);
        return sessions.find(s => s.session_name === 'Race') || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding race session for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get all drivers by session
 */
export async function getDriversBySession(sessionKey: number): Promise<Driver[] | null> {
    try {
        return await fetchDriversBySession(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching drivers for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Build pole sitter data from qualifying session
 */
export async function getPoleSitter(session: Session): Promise<PoleSitter | null> {
    try {
        const [results, drivers] = await Promise.all([
            fetchSessionResults(session.session_key),
            fetchDriversBySession(session.session_key),
        ]);

        // Find pole position (position 1)
        const poleResult = results.find(r => r.position === 1);
        if (!poleResult) {
            console.log(`[SERVICE] No P1 result found for session ${session.session_key}`);
            return null;
        }

        // Find driver info
        const driver = drivers.find(d => d.driver_number === poleResult.driver_number);
        if (!driver) {
            console.log(
                `[SERVICE] Driver ${poleResult.driver_number} not found in session ${session.session_key}`
            );
            return null;
        }

        return {
            driver: driver.full_name,
            constructor: driver.team_name,
            fastestLap: normalizeDuration(poleResult.duration),
        };
    } catch (error) {
        console.error(`[SERVICE] Error building pole sitter for session ${session.session_key}:`, error);
        throw error;
    }
}

/**
 * Build podium data from race session
 */
export async function getPodium(session: Session): Promise<PodiumFinisher[]> {
    try {
        const [results, drivers] = await Promise.all([
            fetchSessionResults(session.session_key),
            fetchDriversBySession(session.session_key),
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
                        `[SERVICE] Driver ${r.driver_number} not found for position ${r.position}`
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
        console.error(`[SERVICE] Error building podium for session ${session.session_key}:`, error);
        throw error;
    }
}

/**
 * Get complete GP details including meeting info, pole sitter, and podium
 * This is the main service method that orchestrates all data fetching
 */
export async function getGPDetails(gpKey: number, year: number = 2025): Promise<GPDetailsResult> {
    try {
        // 1. Fetch meeting info
        const meetings = await fetchMeetingsByYear(year);
        const meeting = meetings.find(m => m.meeting_key === gpKey);

        if (!meeting) {
            return {
                data: null,
                partialErrors: {},
                error: 'Meeting not found',
            };
        }

        // 2. Fetch pole, podium and drivers in parallel
        const [poleResult, podiumResult, driversResult] = await Promise.allSettled([
            (async () => {
                const session = await getQualifyingSession(gpKey);
                if (!session) return null;
                return getPoleSitter(session);
            })(),
            (async () => {
                const session = await getRaceSession(gpKey);
                if (!session) return [];
                return getPodium(session);
            })(),
            (async () => {
                // Prefer race session for drivers
                const raceSession = await getRaceSession(gpKey);
                if (raceSession) {
                    return getDriversBySession(raceSession.session_key);
                }

                // Fallback to quali
                const qualiSession = await getQualifyingSession(gpKey);
                if (qualiSession) {
                    return getDriversBySession(qualiSession.session_key);
                }

                return [];
            })(),
        ]);


        // 3. Extract results and track errors
        const pole =
            poleResult.status === 'fulfilled' ? poleResult.value : null;

        const podium =
            podiumResult.status === 'fulfilled' ? podiumResult.value : [];

        const drivers =
            driversResult.status === 'fulfilled' ? driversResult.value : [];

        const partialErrors: PartialErrors = {};

        if (poleResult.status === 'rejected') {
            console.error('[SERVICE] Pole sitter fetch failed:', poleResult.reason);
            partialErrors.pole = 'Failed to load pole sitter data';
        }

        if (podiumResult.status === 'rejected') {
            console.error('[SERVICE] Podium fetch failed:', podiumResult.reason);
            partialErrors.podium = 'Failed to load podium data';
        }

        if (driversResult.status === 'rejected') {
            console.error('[SERVICE] Drivers fetch failed:', driversResult.reason);
            partialErrors.drivers = 'Failed to load drivers';
        }


        // 4. Return complete result
        return {
            data: {
                meeting,
                pole,
                podium,
                drivers
            },
            partialErrors,
            error: null,
        };
    } catch (error) {
        console.error(`[SERVICE] Failed to fetch GP details for key ${gpKey}:`, error);
        return {
            data: null,
            partialErrors: {},
            error: error instanceof Error ? error.message : 'Failed to load meeting details',
        };
    }
}

/**
 * Fetch detailed race overview for a driver in a session
 */
export async function getDriverRaceOverview(
    sessionKey: number,
    driverNumber: number
): Promise<DriverRaceOverview | null> {
    try {
        // Fetch driver info
        const drivers = await fetchDriversBySession(sessionKey);
        const driver = drivers.find(d => d.driver_number === driverNumber);

        if (!driver) {
            console.warn(`[SERVICE] Driver ${driverNumber} not found in session ${sessionKey}`);
            return null;
        }

        // Fetch stints and laps in parallel
        const [stints, laps] = await Promise.all([
            fetchStintsByDriverAndSession(sessionKey, driverNumber),
            fetchLapsByDriverAndSession(sessionKey, driverNumber),
        ]);
        
        return {
            driver: {
                number: driver.driver_number,
                name: driver.full_name,
                team: driver.team_name,
            },
            stints,
            laps,
            lap_count: laps.length,
            stint_count: stints.length
        };
    } catch (error) {
        console.error(
            `[SERVICE] Failed to fetch race overview for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}
