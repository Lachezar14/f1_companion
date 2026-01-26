import {
    getDriversBySessionKey,
    getLaps,
    getMeetingsByYear,
    getSessionResults,
    getSessionsByMeetingKey,
    getStintsBySession,
} from '../api/openf1';
import {Driver, Meeting, Session} from '../types';

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

export type DriverLap = {
    lapNumber: number;
    lapTime: string | null;
    sector1: number | null;
    sector2: number | null;
    sector3: number | null;
    isPitOutLap: boolean;
};

export type DriverStint = {
    stintNumber: number;
    compound: string;
    lapStart: number;
    lapEnd: number;
    tyreAgeAtStart: number;
};

export type DriverRaceOverview = {
    driver: {
        number: number;
        name: string;
        team: string;
    };
    stints: DriverStint[];
    laps: DriverLap[];
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
function formatLapTime(seconds: number | null | undefined): string {
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
   HELPER FUNCTIONS
========================= */

/**
 * Find qualifying session for a meeting
 */
export async function findQualifyingSession(meetingKey: number): Promise<Session | null> {
    try {
        const sessions = await getSessionsByMeetingKey(meetingKey);
        return sessions.find(s => s.session_name === 'Qualifying') || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding qualifying session for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Find race session for a meeting
 */
export async function findRaceSession(meetingKey: number): Promise<Session | null> {
    try {
        const sessions = await getSessionsByMeetingKey(meetingKey);
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
        return await getDriversBySessionKey(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching drivers for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Build pole sitter data from qualifying session
 */
async function buildPoleSitter(session: Session): Promise<PoleSitter | null> {
    try {
        const [results, drivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySessionKey(session.session_key),
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
async function buildPodium(session: Session): Promise<PodiumFinisher[]> {
    try {
        const [results, drivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySessionKey(session.session_key),
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

/* =========================
   PUBLIC SERVICE API
========================= */

/**
 * Get complete GP details including meeting info, pole sitter, and podium
 * This is the main service method that orchestrates all data fetching
 */
export async function getGPDetails(gpKey: number, year: number = 2025): Promise<GPDetailsResult> {
    try {
        // 1. Fetch meeting info
        const meetings = await getMeetingsByYear(year);
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
                const session = await findQualifyingSession(gpKey);
                if (!session) return null;
                return buildPoleSitter(session);
            })(),
            (async () => {
                const session = await findRaceSession(gpKey);
                if (!session) return [];
                return buildPodium(session);
            })(),
            (async () => {
                // Prefer race session for drivers
                const raceSession = await findRaceSession(gpKey);
                if (raceSession) {
                    return getDriversBySession(raceSession.session_key);
                }

                // Fallback to quali
                const qualiSession = await findQualifyingSession(gpKey);
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
 * Get only pole sitter for a meeting
 */
export async function getPoleSitter(meetingKey: number): Promise<PoleSitter | null> {
    try {
        const session = await findQualifyingSession(meetingKey);
        if (!session) return null;
        return buildPoleSitter(session);
    } catch (error) {
        console.error(`[SERVICE] Error fetching pole sitter for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get only podium for a meeting
 */
export async function getPodium(meetingKey: number): Promise<PodiumFinisher[]> {
    try {
        const session = await findRaceSession(meetingKey);
        if (!session) return [];
        return buildPodium(session);
    } catch (error) {
        console.error(`[SERVICE] Error fetching podium for meeting ${meetingKey}:`, error);
        return [];
    }
}

/**
 * Get all laps for a driver in a specific session
 */
export async function getDriverLapsForSession(
    sessionKey: number,
    driverNumber: number
): Promise<DriverLap[]> {
    try {
        const laps = await getLaps(sessionKey, { driverNumber });

        return laps
            .sort((a, b) => a.lap_number - b.lap_number)
            .map(lap => ({
                lapNumber: lap.lap_number,
                lapTime: formatLapDuration(lap.lap_duration),
                sector1: lap.duration_sector_1,
                sector2: lap.duration_sector_2,
                sector3: lap.duration_sector_3,
                isPitOutLap: lap.is_pit_out_lap,
            }));
    } catch (error) {
        console.error(
            `[SERVICE] Failed to fetch laps for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        throw error;
    }
}

/**
 * Get all stints for a driver in a specific session
 */
export async function getDriverStintsForSession(
    sessionKey: number,
    driverNumber: number
): Promise<DriverStint[]> {
    try {
        const stints = await getStintsBySession(sessionKey, {
            driverNumber,
        });

        return stints
            .sort((a, b) => a.stint_number - b.stint_number)
            .map(stint => ({
                stintNumber: stint.stint_number,
                compound: stint.compound,
                lapStart: stint.lap_start,
                lapEnd: stint.lap_end,
                tyreAgeAtStart: stint.tyre_age_at_start,
            }));
    } catch (error) {
        console.error(
            `[SERVICE] Failed to fetch stints for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        throw error;
    }
}

export async function getDriverRaceOverview(
    sessionKey: number,
    driverNumber: number
): Promise<DriverRaceOverview> {
    const [drivers, laps, stints] = await Promise.all([
        getDriversBySessionKey(sessionKey),
        getDriverLapsForSession(sessionKey, driverNumber),
        getDriverStintsForSession(sessionKey, driverNumber),
    ]);

    const driver = drivers.find(d => d.driver_number === driverNumber);

    if (!driver) {
        throw new Error(`Driver ${driverNumber} not found in session ${sessionKey}`);
    }

    return {
        driver: {
            number: driver.driver_number,
            name: driver.full_name,
            team: driver.team_name,
        },
        laps,
        stints,
    };
}

