import {
    fetchDriversBySession,
    fetchDriversByMeetingKey,
    fetchLapsByDriverAndSession,
    fetchLapsBySession,
    fetchMeetingsByYear,
    fetchMeetingsByKey,
    fetchSessionResults,
    fetchSessionResultsByFilters,
    fetchSessionsByMeeting,
    fetchStintsByDriverAndSession,
    fetchStintsBySession,
    fetchCarDataByDriverAndSession,
    fetchStartingGridBySession,
} from '../api/openf1';
import {
    Driver,
    Lap,
    Meeting,
    Session,
    SessionResult,
    Stint,
    StartingGrid,
    QualifyingDriverClassification,
    RaceDriverClassification,
    DriverSeasonStats,
    DriverSeasonContext,
} from '../types';

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
    raceResults: SessionResult[];
};

export type PartialErrors = {
    pole?: string;
    podium?: string;
    drivers?: string;
    raceResults?: string;
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
    raceResult: SessionResult | null;
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

const calculateAverage = (values: number[]): number | null => {
    if (!values.length) return null;
    const sum = values.reduce((total, value) => total + value, 0);
    return sum / values.length;
};

/**
 * Format a gap value into a readable string
 */
function formatGapValue(
    gap: number | string | number[] | null | undefined
): string | null {
    if (gap == null) return null;

    if (Array.isArray(gap)) {
        const valid = gap.filter(
            (value): value is number => typeof value === 'number' && !Number.isNaN(value)
        );
        if (!valid.length) return null;
        return `+${valid[valid.length - 1].toFixed(3)}s`;
    }

    if (typeof gap === 'number') {
        const prefix = gap >= 0 ? '+' : '';
        return `${prefix}${gap.toFixed(3)}s`;
    }

    return typeof gap === 'string' ? gap : null;
}

/**
 * Derive a textual status from a session result
 */
function resultStatusLabel(result: SessionResult, defaultLabel: string | null = 'Finished'): string | null {
    if (result.dsq) return 'DSQ';
    if (result.dnf) return 'DNF';
    if (result.dns) return 'DNS';
    return defaultLabel;
}

/* =========================
   MEETINGS SERVICE
========================= */

/**
 * Get all meetings for a year
 */
export async function getMeetingsByYear(year: number): Promise<Meeting[] | null> {
    try {
        return await fetchMeetingsByYear(year);
    } catch (error) {
        console.error(`[SERVICE] Error fetching meetings for year ${year}:`, error);
        return null;
    }
}

/**
 * Get meeting by key
 */
export async function getMeetingByKey(meetingKey: number): Promise<Meeting | null> {
    try {
        const meetings = await fetchMeetingsByKey(meetingKey);
        return meetings[0] || null;
    } catch (error) {
        console.error(`[SERVICE] Error fetching meeting ${meetingKey}:`, error);
        return null;
    }
}

/* =========================
   SESSIONS SERVICE
========================= */

/**
 * Get all sessions for a meeting
 */
export async function getSessionsByMeeting(meetingKey: number): Promise<Session[] | null> {
    try {
        return await fetchSessionsByMeeting(meetingKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching sessions for meeting ${meetingKey}:`, error);
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
 * Get sprint session for a meeting (if exists)
 */
export async function getSprintSession(meetingKey: number): Promise<Session | null> {
    try {
        const sessions = await fetchSessionsByMeeting(meetingKey);
        return sessions.find(s => s.session_name === 'Sprint') || null;
    } catch (error) {
        console.error(`[SERVICE] Error finding sprint session for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get all practice sessions for a meeting
 */
export async function getPracticeSessions(meetingKey: number): Promise<Session[]> {
    try {
        const sessions = await fetchSessionsByMeeting(meetingKey);
        return sessions.filter(s => s.session_name.includes('Practice'));
    } catch (error) {
        console.error(`[SERVICE] Error finding practice sessions for meeting ${meetingKey}:`, error);
        return [];
    }
}

/* =========================
   DRIVERS SERVICE
========================= */

/**
 * Get all drivers in a session
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
 * Get all drivers participating in a season
 */
export async function getDriversByMeeting(meetingKey: number): Promise<Driver[]> {
    try {
        return await fetchDriversByMeetingKey(meetingKey);
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching drivers for meeting ${meetingKey}:`,
            error
        );
        return [];
    }
}

/**
 * Get a specific driver in a session
 */
export async function getDriverByNumber(
    sessionKey: number,
    driverNumber: number
): Promise<Driver | null> {
    try {
        const drivers = await fetchDriversBySession(sessionKey);
        return drivers.find(d => d.driver_number === driverNumber) || null;
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}

/* =========================
   SESSION RESULTS SERVICE
========================= */

/**
 * Get all results for a session
 */
export async function getSessionResults(sessionKey: number): Promise<SessionResult[] | null> {
    try {
        return await fetchSessionResults(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching session results for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get qualifying results for a meeting
 * Optimized: fetches session and results in one go instead of filtering all sessions
 */
export async function getQualifyingSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    try {
        const qualiSession = await getQualifyingSession(meetingKey);
        if (!qualiSession) {
            console.log(`[SERVICE] No qualifying session found for meeting ${meetingKey}`);
            return null;
        }

        return await fetchSessionResults(qualiSession.session_key);
    } catch (error) {
        console.error(`[SERVICE] Error fetching qualifying results for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get race results for a meeting
 * Optimized: fetches session and results in one go instead of filtering all sessions
 */
export async function getRaceSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    try {
        const raceSession = await getRaceSession(meetingKey);
        if (!raceSession) {
            console.log(`[SERVICE] No race session found for meeting ${meetingKey}`);
            return null;
        }

        return await fetchSessionResults(raceSession.session_key);
    } catch (error) {
        console.error(`[SERVICE] Error fetching race results for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get sprint results for a meeting
 * Optimized: fetches session and results in one go instead of filtering all sessions
 */
export async function getSprintSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    try {
        const sprintSession = await getSprintSession(meetingKey);
        if (!sprintSession) {
            console.log(`[SERVICE] No sprint session found for meeting ${meetingKey}`);
            return null;
        }

        return await fetchSessionResults(sprintSession.session_key);
    } catch (error) {
        console.error(`[SERVICE] Error fetching sprint results for meeting ${meetingKey}:`, error);
        return null;
    }
}

/**
 * Get a specific driver's result for a session
 */
export async function getDriverSessionResult(
    sessionKey: number,
    driverNumber: number
): Promise<SessionResult | null> {
    try {
        const sessionResults = await fetchSessionResults(sessionKey);
        return sessionResults.find(s => s.driver_number === driverNumber) || null;
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching driver session result for session ${sessionKey}, driver ${driverNumber}:`,
            error
        );
        return null;
    }
}

/* =========================
   LAPS SERVICE
========================= */

/**
 * Get all laps for a session
 */
export async function getLapsBySession(sessionKey: number): Promise<Lap[] | null> {
    try {
        return await fetchLapsBySession(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching laps for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get all laps for a driver in a session
 */
export async function getLapsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Lap[] | null> {
    try {
        return await fetchLapsByDriverAndSession(sessionKey, driverNumber);
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching laps for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}

/**
 * Get fastest lap in a session (across all drivers)
 */
export async function getFastestLapInSession(sessionKey: number): Promise<{
    lap: Lap;
    driver: Driver;
} | null> {
    try {
        const [laps, drivers] = await Promise.all([
            fetchLapsBySession(sessionKey),
            fetchDriversBySession(sessionKey),
        ]);

        const validLaps = laps.filter(lap => lap.lap_duration != null && lap.lap_duration > 0);
        if (!validLaps.length) return null;

        const fastestLap = validLaps.reduce((fastest, current) =>
            current.lap_duration! < fastest.lap_duration! ? current : fastest
        );

        const driver = drivers.find(d => d.driver_number === fastestLap.driver_number);
        if (!driver) return null;

        return { lap: fastestLap, driver };
    } catch (error) {
        console.error(`[SERVICE] Error finding fastest lap for session ${sessionKey}:`, error);
        return null;
    }
}

/* =========================
   STINTS SERVICE
========================= */

/**
 * Get all stints for a session
 */
export async function getStintsBySession(sessionKey: number): Promise<Stint[] | null> {
    try {
        return await fetchStintsBySession(sessionKey);
    } catch (error) {
        console.error(`[SERVICE] Error fetching stints for session ${sessionKey}:`, error);
        return null;
    }
}

/**
 * Get all stints for a driver in a session
 */
export async function getStintsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Stint[] | null> {
    try {
        return await fetchStintsByDriverAndSession(sessionKey, driverNumber);
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching stints for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}

/* =========================
   CAR DATA SERVICE
========================= */

/**
 * Get car telemetry data for a driver in a session
 */
export async function getCarDataByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<any[] | null> {
    try {
        return await fetchCarDataByDriverAndSession(sessionKey, driverNumber);
    } catch (error) {
        console.error(
            `[SERVICE] Error fetching car data for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}

/* =========================
   COMPOSITE SERVICES
   These combine multiple API calls for complex business logic
========================= */

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
            .filter(
                (r): r is SessionResult & { position: number } =>
                    typeof r.position === 'number' && r.position <= 3
            )
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
 * Get complete GP details including meeting info, pole sitter, podium, and race results
 * This is the main service method that orchestrates all data fetching for a GP overview
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

        // 2. Fetch pole, podium, drivers, and race results in parallel
        const [poleResult, podiumResult, driversResult, raceResultsResult] = await Promise.allSettled([
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
            (async () => {
                const session = await getRaceSession(gpKey);
                if (!session) return [];
                return getSessionResults(session.session_key) || [];
            })(),
        ]);

        // 3. Extract results and track errors
        const pole = poleResult.status === 'fulfilled' ? poleResult.value : null;
        const podium = podiumResult.status === 'fulfilled' ? podiumResult.value : [];
        const drivers =
            driversResult.status === 'fulfilled' ? driversResult.value ?? [] : [];
        const raceResults =
            raceResultsResult.status === 'fulfilled' ? raceResultsResult.value ?? [] : [];

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

        if (raceResultsResult.status === 'rejected') {
            console.error('[SERVICE] Race results fetch failed:', raceResultsResult.reason);
            partialErrors.raceResults = 'Failed to load race results';
        }

        // 4. Return complete result
        return {
            data: {
                meeting,
                pole,
                podium,
                drivers,
                raceResults,
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
 * Includes stints, laps, and race result
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

        // Fetch stints, laps, and race result in parallel
        const [stints, laps, raceResult] = await Promise.all([
            fetchStintsByDriverAndSession(sessionKey, driverNumber),
            fetchLapsByDriverAndSession(sessionKey, driverNumber),
            getDriverSessionResult(sessionKey, driverNumber),
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
            stint_count: stints.length,
            raceResult,
        };
    } catch (error) {
        console.error(
            `[SERVICE] Failed to fetch race overview for driver ${driverNumber} in session ${sessionKey}:`,
            error
        );
        return null;
    }
}

/* =========================
   CLASSIFICATION HELPERS
========================= */

const isValidLapValue = (value: number | null | undefined): value is number =>
    typeof value === 'number' && value > 0;

const formatLapSegment = (value: number | null | undefined): string | null =>
    isValidLapValue(value) ? formatLapTime(value) : null;

export async function getQualifyingClassification(
    sessionKey: number
): Promise<QualifyingDriverClassification[] | null> {
    try {
        const [results, drivers] = await Promise.all([
            fetchSessionResults(sessionKey),
            fetchDriversBySession(sessionKey),
        ]);

        const driverMap = new Map(drivers.map(driver => [driver.driver_number, driver]));

        const rows: QualifyingDriverClassification[] = [];

        results.forEach(result => {
            const driver = driverMap.get(result.driver_number);
            if (!driver) {
                console.warn(
                    `[SERVICE] Driver ${result.driver_number} missing for qualifying classification in session ${sessionKey}`
                );
                return;
            }

            const durations = Array.isArray(result.duration) ? result.duration : [];
            const bestSeconds = durations.filter(isValidLapValue);
            const best = bestSeconds.length ? formatLapTime(Math.min(...bestSeconds)) : null;
            const gapToPole =
                result.position === 1 ? 'Pole' : formatGapValue(result.gap_to_leader);

            rows.push({
                position: typeof result.position === 'number' ? result.position : null,
                driverNumber: result.driver_number,
                driverName: driver.full_name,
                teamName: driver.team_name,
                teamColor: driver.team_colour,
                q1: formatLapSegment(durations[0]),
                q2: formatLapSegment(durations[1]),
                q3: formatLapSegment(durations[2]),
                best,
                gapToPole,
                status: resultStatusLabel(result, null),
            });
        });

        rows.sort((a, b) => {
            if (a.position === null && b.position === null) return 0;
            if (a.position === null) return 1;
            if (b.position === null) return -1;
            return a.position - b.position;
        });

        return rows;
    } catch (error) {
        console.error(
            `[SERVICE] Error building qualifying classification for session ${sessionKey}:`,
            error
        );
        return null;
    }
}

export async function getRaceClassification(
    sessionKey: number
): Promise<RaceDriverClassification[] | null> {
    try {
        const [results, drivers] = await Promise.all([
            fetchSessionResults(sessionKey),
            fetchDriversBySession(sessionKey),
        ]);

        let startingGrid: StartingGrid[] = [];
        let stints: Stint[] = [];

        try {
            startingGrid = await fetchStartingGridBySession(sessionKey);
        } catch (error) {
            console.warn(
                `[SERVICE] Starting grid unavailable for session ${sessionKey}:`,
                error
            );
        }

        try {
            stints = await fetchStintsBySession(sessionKey);
        } catch (error) {
            console.warn(`[SERVICE] Stints unavailable for session ${sessionKey}:`, error);
        }

        const driverMap = new Map(drivers.map(driver => [driver.driver_number, driver]));
        const gridMap = new Map(startingGrid.map(entry => [entry.driver_number, entry.position]));

        const stintCounts = new Map<number, number>();
        stints.forEach(stint => {
            stintCounts.set(stint.driver_number, (stintCounts.get(stint.driver_number) || 0) + 1);
        });

        const rows: RaceDriverClassification[] = [];

        results.forEach(result => {
            const driver = driverMap.get(result.driver_number);
            if (!driver) {
                console.warn(
                    `[SERVICE] Driver ${result.driver_number} missing for race classification in session ${sessionKey}`
                );
                return;
            }

            const totalTime =
                typeof result.duration === 'number' ? formatRaceTime(result.duration) : null;

            const pitStintCount = stintCounts.get(result.driver_number);
            const pitStops =
                typeof pitStintCount === 'number' ? Math.max(pitStintCount - 1, 0) : null;

            const baseStatus = resultStatusLabel(result, 'Finished') || 'Finished';
            const normalizedStatus =
                result.position === 1 && baseStatus === 'Finished' ? 'Winner' : baseStatus;

            rows.push({
                position: typeof result.position === 'number' ? result.position : null,
                driverNumber: result.driver_number,
                driverName: driver.full_name,
                teamName: driver.team_name,
                teamColor: driver.team_colour,
                gridPosition: gridMap.get(result.driver_number) ?? null,
                laps: result.number_of_laps,
                totalTime,
                gapToLeader:
                    result.position === 1 ? 'Winner' : formatGapValue(result.gap_to_leader),
                pitStops,
                status: normalizedStatus,
            });
        });

        rows.sort((a, b) => {
            if (a.position === null && b.position === null) return 0;
            if (a.position === null) return 1;
            if (b.position === null) return -1;
            return a.position - b.position;
        });

        return rows;
    } catch (error) {
        console.error(
            `[SERVICE] Error building race classification for session ${sessionKey}:`,
            error
        );
        return null;
    }
}

const toNumericPosition = (value: number | null | undefined): number | null =>
    typeof value === 'number' && value > 0 ? value : null;

const averagePositionOrNull = (values: number[]): number | null => {
    const average = calculateAverage(values);
    return average === null ? null : Number(average.toFixed(2));
};

/**
 * Aggregate season-long statistics for a driver
 */
export async function getDriverSeasonStats(
    driverNumber: number,
    year: number,
    context?: DriverSeasonContext
): Promise<DriverSeasonStats | null> {
    try {
        const [raceResults, qualifyingResults] = await Promise.all([
            fetchSessionResultsByFilters({
                driver_number: driverNumber,
                year,
                session_type: 'Race',
            }),
            fetchSessionResultsByFilters({
                driver_number: driverNumber,
                year,
                session_type: 'Qualifying',
            }),
        ]);

        let supplementalDriver: Driver | null = null;

        const needsSupplementalProfile =
            !context?.name || !context?.team || !context?.teamColor || !context?.headshotUrl;

        if (needsSupplementalProfile) {
            const referenceSessionKey =
                raceResults[0]?.session_key ?? qualifyingResults[0]?.session_key ?? null;

            if (referenceSessionKey) {
                try {
                    const sessionDrivers = await fetchDriversBySession(referenceSessionKey);
                    supplementalDriver =
                        sessionDrivers.find(driver => driver.driver_number === driverNumber) ?? null;
                } catch (profileError) {
                    console.warn(
                        `[SERVICE] Unable to supplement driver profile for session ${referenceSessionKey}:`,
                        profileError
                    );
                }
            }
        }

        const racePositions = raceResults
            .map(result => toNumericPosition(result.position))
            .filter((position): position is number => position !== null);

        const qualifyingPositions = qualifyingResults
            .map(result => toNumericPosition(result.position))
            .filter((position): position is number => position !== null);

        const wins = racePositions.filter(position => position === 1).length;
        const podiums = racePositions.filter(position => position >= 1 && position <= 3).length;

        const bestRaceResult = racePositions.length ? Math.min(...racePositions) : null;
        const bestQualifyingResult = qualifyingPositions.length
            ? Math.min(...qualifyingPositions)
            : null;

        return {
            season: year,
            driver: {
                number: driverNumber,
                name: context?.name ?? supplementalDriver?.full_name ?? 'Unknown Driver',
                team: context?.team ?? supplementalDriver?.team_name ?? 'Unknown Team',
                teamColor: context?.teamColor ?? supplementalDriver?.team_colour,
                headshotUrl: context?.headshotUrl ?? supplementalDriver?.headshot_url,
            },
            totals: {
                wins,
                podiums,
                races: racePositions.length,
                averageRacePosition: averagePositionOrNull(racePositions),
                averageQualifyingPosition: averagePositionOrNull(qualifyingPositions),
                bestRaceResult,
                bestQualifyingResult,
                qualifyingSessions: qualifyingPositions.length,
            },
        };
    } catch (error) {
        console.error(
            `[SERVICE] Failed to build season stats for driver ${driverNumber} in year ${year}:`,
            error
        );
        return null;
    }
}
