import {
    fetchDriversByMeetingKey,
    fetchDriversBySession,
    fetchQualifyingSessionsByYear,
    fetchRaceSessionsByYear,
    fetchSessionResultsByDriver,
} from '../api/openf1';
import type {
    Driver,
    DriverSeasonContext,
    DriverSeasonSessionSummary,
    DriverSeasonStats,
    Session,
    SessionResult,
} from '../types';
import { formatLapTime, formatRaceTime } from '../../shared/time';
import { withServiceError } from './utils';
import { getMeetingsByYear } from './meetingsService';

type SessionClassificationGroup = 'Race' | 'Qualifying';

export function getDriversBySession(sessionKey: number): Promise<Driver[]> {
    return withServiceError(
        `Failed to fetch drivers for session ${sessionKey}`,
        () => fetchDriversBySession(sessionKey)
    );
}

export function getDriversByMeeting(meetingKey: number): Promise<Driver[]> {
    return withServiceError(
        `Failed to fetch drivers for meeting ${meetingKey}`,
        () => fetchDriversByMeetingKey(meetingKey)
    );
}

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

export async function getDriverByNumber(
    sessionKey: number,
    driverNumber: number
): Promise<Driver | null> {
    const drivers = await getDriversBySession(sessionKey);
    return drivers.find(d => d.driver_number === driverNumber) || null;
}

const calculateAverage = (values: number[]): number | null => {
    if (!values.length) return null;
    const sum = values.reduce((total, value) => total + value, 0);
    return sum / values.length;
};

const normalizeDuration = (duration: number | number[] | null | undefined): string | null => {
    if (!duration) return null;

    if (Array.isArray(duration)) {
        const validLaps = duration.filter(d => d != null && d > 0);
        if (!validLaps.length) return null;
        const fastest = Math.min(...validLaps);
        return formatLapTime(fastest);
    }

    return formatRaceTime(duration);
};

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

const resultStatusLabel = (
    result: SessionResult,
    defaultLabel: string | null = 'Finished'
): string | null => {
    if (result.dsq) return 'DSQ';
    if (result.dnf) return 'DNF';
    if (result.dns) return 'DNS';
    return defaultLabel;
};

const toNumericPosition = (value: number | null | undefined): number | null =>
    typeof value === 'number' && value > 0 ? value : null;

const averagePositionOrNull = (values: number[]): number | null => {
    const average = calculateAverage(values);
    return average === null ? null : Number(average.toFixed(2));
};

const sortSummariesByDate = (
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

export function getDriverSeasonStats(
    driverNumber: number,
    year: number,
    context?: DriverSeasonContext
): Promise<DriverSeasonStats | null> {
    return withServiceError(
        `Failed to build season stats for driver ${driverNumber} in year ${year}`,
        async () => {
            const [raceSessionsRaw, qualifyingSessionsRaw, driverResults] = await Promise.all([
                fetchRaceSessionsByYear(year),
                fetchQualifyingSessionsByYear(year),
                fetchSessionResultsByDriver(driverNumber),
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

            raceSummaries.sort(sortSummariesByDate);
            qualifyingSummaries.sort(sortSummariesByDate);

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
