import {
    fetchCarDataByDriverAndSession,
    fetchDriversByMeetingKey,
    fetchDriversBySession,
    fetchLapsByDriverAndSession,
    fetchLapsBySession,
    fetchMeetingsByKey,
    fetchMeetingsByYear,
    fetchQualifyingSessionsByYear, fetchRaceControlBySession,
    fetchRaceSessionsByYear,
    fetchSessionResults,
    fetchSessionResultsByDriver,
    fetchSessionsByMeeting,
    fetchStartingGridBySession,
    fetchStintsByDriverAndSession,
    fetchStintsBySession,
} from '../api/openf1';
import {
    Driver,
    DriverSeasonContext,
    DriverSeasonSessionSummary,
    DriverSeasonStats,
    Lap,
    Meeting,
    QualifyingDriverClassification, RaceControl,
    RaceDriverClassification,
    Session,
    SessionResult,
    StartingGrid,
    Stint,
} from '../types';
import {OpenF1ServiceError} from './errors';
import {formatLapTime, formatRaceTime} from '../../shared/time';

type SessionClassificationGroup = 'Race' | 'Qualifying';

/* =========================
   TYPE DEFINITIONS
========================= */

export type PodiumFinisher = {
    position: number;
    driver: string;
    constructor: string;
    time: string | null;
};

export type DriverRaceOverview = {
    driver: {
        number: number;
        name: string;
        team: string;
        teamColor?: string | null;
        headshotUrl?: string | null;
    };
    stints: Stint[];
    laps: Lap[];
    lap_count: number;
    stint_count: number;
    raceResult: SessionResult | null;
};

async function withServiceError<T>(message: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        console.error(message, error);
        if (error instanceof OpenF1ServiceError) {
            throw error;
        }
        throw new OpenF1ServiceError(message, error);
    }
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
export function getMeetingsByYear(year: number): Promise<Meeting[]> {
    return withServiceError(
        `Failed to fetch meetings for year ${year}`,
        () => fetchMeetingsByYear(year)
    );
}

/**
 * Get meeting by key
 */
export async function getMeetingByKey(meetingKey: number): Promise<Meeting | null> {
    const meetings = await withServiceError(
        `Failed to fetch meeting ${meetingKey}`,
        () => fetchMeetingsByKey(meetingKey)
    );
    return meetings[0] ?? null;
}

/* =========================
   SESSIONS SERVICE
========================= */

/**
 * Get all sessions for a meeting
 */
export function getSessionsByMeeting(meetingKey: number): Promise<Session[]> {
    return withServiceError(
        `Failed to fetch sessions for meeting ${meetingKey}`,
        () => fetchSessionsByMeeting(meetingKey)
    );
}

/**
 * Get qualifying session for a meeting
 */
export async function getQualifyingSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Qualifying') || null;
}

/**
 * Get race session for a meeting
 */
export async function getRaceSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Race') || null;
}

/**
 * Get sprint session for a meeting (if exists)
 */
export async function getSprintSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Sprint') || null;
}

/**
 * Get all practice sessions for a meeting
 */
export async function getPracticeSessions(meetingKey: number): Promise<Session[]> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.filter(s => s.session_name.includes('Practice'));
}

/**
 * Get race sessions for a year
 */
export async function getRaceSessionsByYear(year: number): Promise<Session[] | null> {
    return await fetchRaceSessionsByYear(year);
}

/**
 * Get qualifying sessions for a year
 */
export async function getQualifyingSessionsByYear(year: number): Promise<Session[] | null> {
    return await fetchQualifyingSessionsByYear(year);
}

/* =========================
   DRIVERS SERVICE
========================= */

/**
 * Get all drivers in a session
 */
export function getDriversBySession(sessionKey: number): Promise<Driver[]> {
    return withServiceError(
        `Failed to fetch drivers for session ${sessionKey}`,
        () => fetchDriversBySession(sessionKey)
    );
}

/**
 * Get all drivers participating in a season
 */
export function getDriversByMeeting(meetingKey: number): Promise<Driver[]> {
    return withServiceError(
        `Failed to fetch drivers for meeting ${meetingKey}`,
        () => fetchDriversByMeetingKey(meetingKey)
    );
}

/**
 * Get the season driver lineup using the first meeting as reference
 */
export async function getSeasonDrivers(year: number): Promise<Driver[]> {
    const meetings = await getMeetingsByYear(year);
    if (!meetings.length) {
        console.warn(`[SERVICE] No meetings found for year ${year} when loading drivers`);
        return [];
    }

    const sortedMeetings = [...meetings].sort(
        (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );

    const referenceMeeting = sortedMeetings[0];
    return getDriversByMeeting(referenceMeeting.meeting_key);
}

/**
 * Get a specific driver in a session
 */
export async function getDriverByNumber(
    sessionKey: number,
    driverNumber: number
): Promise<Driver | null> {
    const drivers = await getDriversBySession(sessionKey);
    return drivers.find(d => d.driver_number === driverNumber) || null;
}

/* =========================
   SESSION RESULTS SERVICE
========================= */

/**
 * Get all results for a session
 */
export function getSessionResults(sessionKey: number): Promise<SessionResult[]> {
    return withServiceError(
        `Failed to fetch session results for session ${sessionKey}`,
        () => fetchSessionResults(sessionKey)
    );
}

/**
 * Get all results for a driver ever
 */
export function getSessionResultsByDriver(driverNumber: number): Promise<SessionResult[]> {
    return withServiceError(
        `Failed to fetch session results for driver ${driverNumber}`,
        () => fetchSessionResultsByDriver(driverNumber)
    );
}

/**
 * Get qualifying results for a meeting
 */
export async function getQualifyingSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const qualiSession = await getQualifyingSession(meetingKey);
    if (!qualiSession) {
        console.log(`[SERVICE] No qualifying session found for meeting ${meetingKey}`);
        return null;
    }

    return getSessionResults(qualiSession.session_key);
}

/**
 * Get race results for a meeting
 */
export async function getRaceSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const raceSession = await getRaceSession(meetingKey);
    if (!raceSession) {
        console.log(`[SERVICE] No race session found for meeting ${meetingKey}`);
        return null;
    }

    return getSessionResults(raceSession.session_key);
}

/**
 * Get sprint results for a meeting
 */
export async function getSprintSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const sprintSession = await getSprintSession(meetingKey);
    if (!sprintSession) {
        console.log(`[SERVICE] No sprint session found for meeting ${meetingKey}`);
        return null;
    }

    return getSessionResults(sprintSession.session_key);
}

/**
 * Get a specific driver's result for a session
 */
export async function getDriverSessionResult(
    sessionKey: number,
    driverNumber: number
): Promise<SessionResult | null> {
    const sessionResults = await getSessionResults(sessionKey);
    return sessionResults.find(s => s.driver_number === driverNumber) || null;
}

/* =========================
   LAPS SERVICE
========================= */

/**
 * Get all laps for a session
 */
export function getLapsBySession(sessionKey: number): Promise<Lap[]> {
    return withServiceError(
        `Failed to fetch laps for session ${sessionKey}`,
        () => fetchLapsBySession(sessionKey)
    );
}

/**
 * Get all laps for a driver in a session
 */
export function getLapsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Lap[]> {
    return withServiceError(
        `Failed to fetch laps for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchLapsByDriverAndSession(sessionKey, driverNumber)
    );
}

/**
 * Get fastest lap in a session (across all drivers)
 */
export async function getFastestLapInSession(sessionKey: number): Promise<{
    lap: Lap;
    driver: Driver;
} | null> {
    const [laps, drivers] = await Promise.all([
        getLapsBySession(sessionKey),
        getDriversBySession(sessionKey),
    ]);

    const validLaps = laps.filter(lap => lap.lap_duration != null && lap.lap_duration > 0);
    if (!validLaps.length) return null;

    const fastestLap = validLaps.reduce((fastest, current) =>
        current.lap_duration! < fastest.lap_duration! ? current : fastest
    );

    const driver = drivers.find(d => d.driver_number === fastestLap.driver_number);
    if (!driver) return null;

    return { lap: fastestLap, driver };
}

/* =========================
   STINTS SERVICE
========================= */

/**
 * Get all stints for a session
 */
export function getStintsBySession(sessionKey: number): Promise<Stint[]> {
    return withServiceError(
        `Failed to fetch stints for session ${sessionKey}`,
        () => fetchStintsBySession(sessionKey)
    );
}

/**
 * Get all stints for a driver in a session
 */
export function getStintsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Stint[]> {
    return withServiceError(
        `Failed to fetch stints for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchStintsByDriverAndSession(sessionKey, driverNumber)
    );
}

/* =========================
   CAR DATA SERVICE
========================= */

/**
 * Get car telemetry data for a driver in a session
 */
export function getCarDataByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<any[]> {
    return withServiceError(
        `Failed to fetch car data for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchCarDataByDriverAndSession(sessionKey, driverNumber)
    );
}

/* =========================
   RACE CONTROL SERVICE
========================= */

/**
 * Get race control messages for a session
 */
type RaceControlApiResponse = {
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

function normalizeRaceControl(entry: RaceControlApiResponse): RaceControl {
    return {
        category: entry.category,
        date: entry.date,
        driverNumber: entry.driver_number ?? null,
        flag: entry.flag ?? null,
        lapNumber: entry.lap_number ?? null,
        meetingKey: entry.meeting_key,
        sessionKey: entry.session_key,
        message: entry.message,
        qualifyingPhase: entry.qualifying_phase ?? null,
        scope: entry.scope ?? null,
        sector: entry.sector ?? null,
    };
}

export async function getRaceControlBySession(
    sessionKey: number
): Promise<RaceControl[]> {
    return withServiceError(
        `Failed to fetch race control for session ${sessionKey}`,
        async () => {
            const raw = await fetchRaceControlBySession(sessionKey);
            return raw.map(normalizeRaceControl);
        }
    );
}

/* =========================
   COMPOSITE SERVICES
   These combine multiple API calls for complex business logic
========================= */

/**
 * Build podium data from race session
 */
export function getPodium(session: Session): Promise<PodiumFinisher[]> {
    return withServiceError(
        `Failed to build podium for session ${session.session_key}`,
        async () => {
            const [results, drivers] = await Promise.all([
                fetchSessionResults(session.session_key),
                fetchDriversBySession(session.session_key),
            ]);

            const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

            return results
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
        }
    );
}

/**
 * Fetch detailed race overview for a driver in a session
 * Includes stints, laps, and race result
 */
export function getDriverRaceOverview(
    sessionKey: number,
    driverNumber: number
): Promise<DriverRaceOverview | null> {
    return withServiceError(
        `Failed to load race overview for driver ${driverNumber} in session ${sessionKey}`,
        async () => {
            const drivers = await getDriversBySession(sessionKey);
            const driver = drivers.find(d => d.driver_number === driverNumber);

            if (!driver) {
                console.warn(`[SERVICE] Driver ${driverNumber} not found in session ${sessionKey}`);
                return null;
            }

            const [stints, laps, raceResult] = await Promise.all([
                getStintsByDriverAndSession(sessionKey, driverNumber),
                getLapsByDriverAndSession(sessionKey, driverNumber),
                getDriverSessionResult(sessionKey, driverNumber),
            ]);

            return {
                driver: {
                    number: driver.driver_number,
                    name: driver.full_name,
                    team: driver.team_name,
                    teamColor: driver.team_colour || null,
                    headshotUrl: driver.headshot_url || null,
                },
                stints,
                laps,
                lap_count: laps.length,
                stint_count: stints.length,
                raceResult,
            };
        }
    );
}

/* =========================
   CLASSIFICATION HELPERS
========================= */

const isValidLapValue = (value: number | null | undefined): value is number =>
    typeof value === 'number' && value > 0;

const formatLapSegment = (value: number | null | undefined): string | null =>
    isValidLapValue(value) ? formatLapTime(value) : null;

export function getQualifyingClassification(
    sessionKey: number
): Promise<QualifyingDriverClassification[]> {
    return withServiceError(
        `Failed to build qualifying classification for session ${sessionKey}`,
        async () => {
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
        }
    );
}

export function getRaceClassification(
    sessionKey: number
): Promise<RaceDriverClassification[]> {
    return withServiceError(
        `Failed to build race classification for session ${sessionKey}`,
        async () => {
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
        }
    );
}

const toNumericPosition = (value: number | null | undefined): number | null =>
    typeof value === 'number' && value > 0 ? value : null;

const averagePositionOrNull = (values: number[]): number | null => {
    const average = calculateAverage(values);
    return average === null ? null : Number(average.toFixed(2));
};

const sortSessionSummariesByDate = (
    a: DriverSeasonSessionSummary,
    b: DriverSeasonSessionSummary
): number => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime();

const buildDriverSeasonSessionSummary = (
    session: Session,
    result: SessionResult,
    group: SessionClassificationGroup
): DriverSeasonSessionSummary => {
    const numericPosition = toNumericPosition(result.position);
    const gapLabel =
        group === 'Race'
            ? numericPosition === 1
                ? 'Winner'
                : formatGapValue(result.gap_to_leader)
            : numericPosition === 1
                ? 'Pole'
                : formatGapValue(result.gap_to_leader);

    const baseStatus = resultStatusLabel(result, group === 'Race' ? 'Finished' : null);
    const normalizedStatus =
        group === 'Race' && numericPosition === 1 && baseStatus === 'Finished'
            ? 'Winner'
            : baseStatus;

    return {
        sessionKey: session.session_key,
        meetingKey: session.meeting_key,
        sessionName: session.session_name,
        sessionType: group,
        circuit: session.circuit_short_name,
        location: session.location,
        countryCode: session.country_code,
        countryName: session.country_name,
        dateStart: session.date_start,
        position: numericPosition,
        laps: typeof result.number_of_laps === 'number' ? result.number_of_laps : null,
        duration: normalizeDuration(result.duration),
        gapToLeader: gapLabel,
        status: normalizedStatus,
    };
};

/**
 * Aggregate season-long statistics for a driver
 */
export function getDriverSeasonStats(
    driverNumber: number,
    year: number,
    context?: DriverSeasonContext
): Promise<DriverSeasonStats | null> {
    return withServiceError(
        `Failed to build season stats for driver ${driverNumber} in year ${year}`,
        async () => {
            const [raceSessionsRaw, qualifyingSessionsRaw, driverResults] = await Promise.all([
                getRaceSessionsByYear(year),
                getQualifyingSessionsByYear(year),
                getSessionResultsByDriver(driverNumber),
            ]);

            const raceSessions = raceSessionsRaw ?? [];
            const qualifyingSessions = qualifyingSessionsRaw ?? [];

            if (!raceSessions.length && !qualifyingSessions.length) {
                console.warn(`[SERVICE] No race or qualifying sessions found for year ${year}`);
                return null;
            }

            const sessionMetadata = new Map<
                number,
                { session: Session; group: SessionClassificationGroup }
            >();

            raceSessions.forEach(session => {
                sessionMetadata.set(session.session_key, { session, group: 'Race' });
            });

            qualifyingSessions.forEach(session => {
                sessionMetadata.set(session.session_key, { session, group: 'Qualifying' });
            });

            const relevantResults = driverResults.filter(result =>
                sessionMetadata.has(result.session_key)
            );

            if (!relevantResults.length) {
                console.warn(
                    `[SERVICE] Driver ${driverNumber} has no results for season ${year}`
                );
                return null;
            }

            const raceSummaries: DriverSeasonSessionSummary[] = [];
            const qualifyingSummaries: DriverSeasonSessionSummary[] = [];

            relevantResults.forEach(result => {
                const metadata = sessionMetadata.get(result.session_key);
                if (!metadata) {
                    return;
                }

                const summary = buildDriverSeasonSessionSummary(
                    metadata.session,
                    result,
                    metadata.group
                );

                if (metadata.group === 'Race') {
                    raceSummaries.push(summary);
                } else {
                    qualifyingSummaries.push(summary);
                }
            });

            raceSummaries.sort(sortSessionSummariesByDate);
            qualifyingSummaries.sort(sortSessionSummariesByDate);

            const racePositions = raceSummaries
                .map(summary => summary.position)
                .filter((position): position is number => position !== null);

            const qualifyingPositions = qualifyingSummaries
                .map(summary => summary.position)
                .filter((position): position is number => position !== null);

            const wins = racePositions.filter(position => position === 1).length;
            const podiums = racePositions.filter(
                position => position >= 1 && position <= 3
            ).length;

            const bestRaceResult = racePositions.length ? Math.min(...racePositions) : null;
            const bestQualifyingResult = qualifyingPositions.length
                ? Math.min(...qualifyingPositions)
                : null;

            let supplementalDriver: Driver | null = null;

            const needsSupplementalProfile =
                !context?.name || !context?.team || !context?.teamColor || !context?.headshotUrl;

            if (needsSupplementalProfile) {
                const referenceSessionKey =
                    raceSummaries[0]?.sessionKey ?? qualifyingSummaries[0]?.sessionKey ?? null;

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
                    races: raceSummaries.length,
                    averageRacePosition: averagePositionOrNull(racePositions),
                    averageQualifyingPosition: averagePositionOrNull(qualifyingPositions),
                    bestRaceResult,
                    bestQualifyingResult,
                    qualifyingSessions: qualifyingSummaries.length,
                },
                sessions: {
                    races: raceSummaries,
                    qualifying: qualifyingSummaries,
                },
            };
        }
    );
}
