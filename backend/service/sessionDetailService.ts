import {
    Driver,
    Lap,
    PracticeSessionDetail,
    QualifyingDriverClassification,
    QualifyingSessionDetail,
    RaceDriverClassification,
    RaceSessionDetail,
    RaceControl,
    RaceControlSummary,
    Session,
    SessionDriverData,
    SessionResult,
    StartingGrid,
    Stint,
    Overtake,
    PitStop,
} from '../types';
import { formatLapTime, formatRaceTime } from '../../shared/time';
import { withServiceError } from './utils';
import {
    getDriversBySession,
    getDriverByNumber,
} from './driversService';
import {
    getSessionResults,
    getLapsBySession,
    getStintsBySession,
    getDriverSessionResult,
    getLapsByDriverAndSession,
    getStintsByDriverAndSession,
    getOvertakesBySession,
    getPitStopsBySession,
    getPitStopsByDriverAndSession,
    getRaceStartingGrid,
} from './sessionDataService';
import {
    getRaceControlBySession,
    summarizeRaceControl,
    getMaxLapCount,
} from './raceControlService';
import { getSessionByKey, getSessionsByMeeting } from './meetingsService';
import { buildQualifyingInsights, buildRaceInsights } from './sessionInsightsService';

export type PodiumFinisher = {
    position: number;
    driver: string;
    constructor: string;
    time: string | null;
};

const isValidLapValue = (value: number | null | undefined): value is number =>
    typeof value === 'number' && value > 0;

const formatLapSegment = (value: number | null | undefined): string | null =>
    isValidLapValue(value) ? formatLapTime(value) : null;

const formatGapValue = (
    gap: number | string | number[] | null | undefined
): string | null => {
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
};

const resultStatusLabel = (result: SessionResult, defaultLabel: string | null = 'Finished'): string | null => {
    if (result.dsq) return 'DSQ';
    if (result.dnf) return 'DNF';
    if (result.dns) return 'DNS';
    return defaultLabel;
};

function buildSessionDriverData(
    drivers: Driver[],
    laps: Lap[],
    stints: Stint[],
    results: SessionResult[],
    pitStops: PitStop[] = [],
    startingGrid: StartingGrid[] = []
): SessionDriverData[] {
    const lapsByDriver = new Map<number, Lap[]>();
    laps.forEach(lap => {
        if (!lapsByDriver.has(lap.driver_number)) {
            lapsByDriver.set(lap.driver_number, []);
        }
        lapsByDriver.get(lap.driver_number)!.push(lap);
    });
    lapsByDriver.forEach(list => list.sort((a, b) => a.lap_number - b.lap_number));

    const stintsByDriver = new Map<number, Stint[]>();
    stints.forEach(stint => {
        if (!stintsByDriver.has(stint.driver_number)) {
            stintsByDriver.set(stint.driver_number, []);
        }
        stintsByDriver.get(stint.driver_number)!.push(stint);
    });
    stintsByDriver.forEach(list => list.sort((a, b) => a.lap_start - b.lap_start));

    const resultMap = new Map(results.map(result => [result.driver_number, result]));

    const pitStopsByDriver = new Map<number, PitStop[]>();
    pitStops.forEach(stop => {
        if (!pitStopsByDriver.has(stop.driver_number)) {
            pitStopsByDriver.set(stop.driver_number, []);
        }
        pitStopsByDriver.get(stop.driver_number)!.push(stop);
    });
    pitStopsByDriver.forEach(list => list.sort((a, b) => a.lap_number - b.lap_number));

    const startingPositionByDriver = new Map<number, number>();
    startingGrid.forEach(entry => {
        if (!startingPositionByDriver.has(entry.driver_number)) {
            startingPositionByDriver.set(entry.driver_number, entry.position);
        }
    });

    return drivers.map(driver => ({
        driverNumber: driver.driver_number,
        driver: {
            number: driver.driver_number,
            name: driver.full_name,
            shortName: driver.name_acronym,
            team: driver.team_name,
            teamColor: driver.team_colour,
            headshotUrl: driver.headshot_url,
        },
        laps: lapsByDriver.get(driver.driver_number) ?? [],
        stints: stintsByDriver.get(driver.driver_number) ?? [],
        pitStops: pitStopsByDriver.get(driver.driver_number) ?? [],
        startingPosition: startingPositionByDriver.get(driver.driver_number) ?? null,
        sessionResult: resultMap.get(driver.driver_number) ?? null,
    }));
}

type DriverEntryOptions = {
    includeStartingGrid?: boolean;
};

async function assembleSingleDriverEntry(
    sessionKey: number,
    driverNumber: number,
    options: DriverEntryOptions = {}
): Promise<SessionDriverData | null> {
    const driver = await getDriverByNumber(sessionKey, driverNumber);
    if (!driver) {
        console.warn(
            `[SERVICE] Driver ${driverNumber} not found in session ${sessionKey} when building single-driver detail`
        );
        return null;
    }

    const includeStartingGrid = options.includeStartingGrid ?? false;

    const [laps, stints, sessionResult, pitStops, startingGrid] = await Promise.all([
        getLapsByDriverAndSession(sessionKey, driverNumber),
        getStintsByDriverAndSession(sessionKey, driverNumber),
        getDriverSessionResult(sessionKey, driverNumber),
        getPitStopsByDriverAndSession(sessionKey, driverNumber),
        includeStartingGrid && driver.meeting_key
            ? getRaceStartingGrid(driver.meeting_key)
            : Promise.resolve([]),
    ]);

    const driverEntries = buildSessionDriverData(
        [driver],
        laps,
        stints,
        sessionResult ? [sessionResult] : [],
        pitStops,
        startingGrid
    );

    return driverEntries[0] ?? null;
}

async function resolveSessionMetadata(
    sessionKey: number,
    drivers: Driver[],
    results: SessionResult[]
): Promise<Session> {
    const meetingKey =
        drivers[0]?.meeting_key ??
        results[0]?.meeting_key ??
        null;

    if (meetingKey != null) {
        const sessions = await getSessionsByMeeting(meetingKey);
        const session = sessions.find(entry => entry.session_key === sessionKey);
        if (session) {
            return session;
        }
    }

    const fallback = await getSessionByKey(sessionKey);
    if (fallback) {
        return fallback;
    }

    const now = new Date();
    return {
        session_key: sessionKey,
        session_name: `Session ${sessionKey}`,
        session_type: 'Unknown',
        meeting_key: meetingKey,
        circuit_key: 0,
        circuit_short_name: '',
        location: '',
        country_key: 0,
        country_code: '',
        country_name: '',
        date_start: now.toISOString(),
        date_end: now.toISOString(),
        gmt_offset: '+00:00',
        year: now.getUTCFullYear(),
    };
}

type SessionDetailResources = {
    session: Session;
    drivers: Driver[];
    laps: Lap[];
    stints: Stint[];
    results: SessionResult[];
    pitStops: PitStop[];
    startingGrid: StartingGrid[];
    raceControl: RaceControl[];
    raceControlSummary: RaceControlSummary;
    driverEntries: SessionDriverData[];
    overtakes: Overtake[];
};

async function assembleSessionDetailResources(sessionKey: number): Promise<SessionDetailResources> {
    const [drivers, laps, stints, results, raceControl, overtakes, pitStops] = await Promise.all([
        getDriversBySession(sessionKey),
        getLapsBySession(sessionKey),
        getStintsBySession(sessionKey),
        getSessionResults(sessionKey),
        getRaceControlBySession(sessionKey),
        getOvertakesBySession(sessionKey),
        getPitStopsBySession(sessionKey),
    ]);

    const session = await resolveSessionMetadata(sessionKey, drivers, results);
    const raceControlSummary = summarizeRaceControl(raceControl, getMaxLapCount(results));
    const sessionType = (session.session_type || '').toLowerCase();
    const sessionName = (session.session_name || '').toLowerCase();
    const isRaceSession =
        sessionType.includes('race') ||
        sessionName.includes('race') ||
        sessionName.includes('grand prix');

    let startingGrid: StartingGrid[] = [];
    if (isRaceSession && session.meeting_key) {
        try {
            startingGrid = await getRaceStartingGrid(session.meeting_key);
        } catch (error) {
            console.warn(
                `[SERVICE] Starting grid unavailable for meeting ${session.meeting_key}:`,
                error
            );
        }
    }
    const driverEntries = buildSessionDriverData(drivers, laps, stints, results, pitStops, startingGrid);

    return {
        session,
        drivers,
        laps,
        stints,
        results,
        pitStops,
        startingGrid,
        raceControl,
        raceControlSummary,
        driverEntries,
        overtakes,
    };
}

export function getPodium(session: Session): Promise<PodiumFinisher[]> {
    return withServiceError(
        `Failed to build podium for session ${session.session_key}`,
        async () => {
            const [results, drivers] = await Promise.all([
                getSessionResults(session.session_key),
                getDriversBySession(session.session_key),
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
                                ? formatRaceTime(r.duration as number)
                                : r.gap_to_leader || null,
                    };
                })
                .filter((p): p is PodiumFinisher => p !== null);
        }
    );
}

function buildQualifyingClassificationFromData(
    results: SessionResult[],
    drivers: Driver[],
    sessionKey: number
): QualifyingDriverClassification[] {
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
        const gapToPole = result.position === 1 ? 'Pole' : formatGapValue(result.gap_to_leader);

        rows.push({
            position: typeof result.position === 'number' ? result.position : null,
            driverNumber: result.driver_number,
            driverName: driver.full_name,
            shortName: driver.name_acronym,
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

function buildRaceClassificationFromData(
    results: SessionResult[],
    drivers: Driver[],
    startingGrid: StartingGrid[],
    stints: Stint[],
    sessionKey: number
): RaceDriverClassification[] {
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

        const totalTime = typeof result.duration === 'number' ? formatRaceTime(result.duration) : null;

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
            gapToLeader: result.position === 1 ? 'Winner' : formatGapValue(result.gap_to_leader),
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

export function getRaceSessionDetail(sessionKey: number): Promise<RaceSessionDetail> {
    return withServiceError(
        `Failed to build race session detail for ${sessionKey}`,
        async () => {
            const resources = await assembleSessionDetailResources(sessionKey);

            const classification = buildRaceClassificationFromData(
                resources.results,
                resources.drivers,
                resources.startingGrid,
                resources.stints,
                sessionKey
            );
            const insights = buildRaceInsights({
                driverEntries: resources.driverEntries,
                overtakes: resources.overtakes,
                pitStops: resources.pitStops,
                raceControlSummary: resources.raceControlSummary,
            });

            return {
                ...resources.session,
                detailType: 'race',
                drivers: resources.driverEntries,
                raceControl: resources.raceControl,
                raceControlSummary: resources.raceControlSummary,
                pitStops: resources.pitStops,
                startingGrid: resources.startingGrid,
                overtakes: resources.overtakes,
                classification,
                insights,
            };
        }
    );
}

export function getQualifyingSessionDetail(sessionKey: number): Promise<QualifyingSessionDetail> {
    return withServiceError(
        `Failed to build qualifying session detail for ${sessionKey}`,
        async () => {
            const resources = await assembleSessionDetailResources(sessionKey);
            const classification = buildQualifyingClassificationFromData(
                resources.results,
                resources.drivers,
                sessionKey
            );
            const insights = buildQualifyingInsights({
                driverEntries: resources.driverEntries,
                results: resources.results,
            });

            return {
                ...resources.session,
                detailType: 'qualifying',
                drivers: resources.driverEntries,
                raceControl: resources.raceControl,
                raceControlSummary: resources.raceControlSummary,
                classification,
                insights,
            };
        }
    );
}

export function getPracticeSessionDetail(sessionKey: number): Promise<PracticeSessionDetail> {
    return withServiceError(
        `Failed to build practice session detail for ${sessionKey}`,
        async () => {
            const resources = await assembleSessionDetailResources(sessionKey);
            return {
                ...resources.session,
                detailType: 'practice',
                drivers: resources.driverEntries,
                raceControl: resources.raceControl,
                raceControlSummary: resources.raceControlSummary,
            };
        }
    );
}

export function getRaceDriverDetail(
    sessionKey: number,
    driverNumber: number
): Promise<SessionDriverData | null> {
    return withServiceError(
        `Failed to build race driver detail for driver ${driverNumber} in session ${sessionKey}`,
        () => assembleSingleDriverEntry(sessionKey, driverNumber, { includeStartingGrid: true })
    );
}

export function getPracticeDriverDetail(
    sessionKey: number,
    driverNumber: number
): Promise<SessionDriverData | null> {
    return withServiceError(
        `Failed to build practice driver detail for driver ${driverNumber} in session ${sessionKey}`,
        () => assembleSingleDriverEntry(sessionKey, driverNumber)
    );
}

export function getQualifyingDriverDetail(
    sessionKey: number,
    driverNumber: number
): Promise<SessionDriverData | null> {
    return withServiceError(
        `Failed to build qualifying driver detail for driver ${driverNumber} in session ${sessionKey}`,
        () => assembleSingleDriverEntry(sessionKey, driverNumber)
    );
}
