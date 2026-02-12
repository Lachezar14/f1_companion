import type {
    FastestPitStopInsight,
    InsightDriverRef,
    Overtake,
    OvertakeDriverInsight,
    OvertakeTeamInsight,
    PaceConsistencyInsight,
    PitImpactInsight,
    PitStop,
    PitTeamInsight,
    PositionGainInsight,
    QualifyingIdealLapInsight,
    QualifyingImprovementInsight,
    QualifyingInsights,
    QualifyingSectorRecord,
    QualifyingSectorWinInsight,
    QualifyingTeamSectorWinInsight,
    RaceControlSummary,
    RaceInsights,
    SessionDriverData,
    SessionResult,
    TeamPositionGainInsight,
    TyreDegradationInsight,
} from '../types';

const isValidPositiveNumber = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const average = (values: number[]): number | null => {
    if (!values.length) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
};

const median = (values: number[]): number | null => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
};

const standardDeviation = (values: number[]): number | null => {
    const avg = average(values);
    if (avg == null) return null;
    const variance =
        values.reduce((acc, value) => acc + (value - avg) * (value - avg), 0) / values.length;
    return Math.sqrt(variance);
};

const slopePerLap = (values: number[]): number | null => {
    if (values.length < 2) return null;

    const meanX = (values.length + 1) / 2;
    const meanY = average(values);
    if (meanY == null) return null;

    let numerator = 0;
    let denominator = 0;
    values.forEach((value, index) => {
        const x = index + 1;
        numerator += (x - meanX) * (value - meanY);
        denominator += (x - meanX) * (x - meanX);
    });

    if (denominator <= 0) return null;
    return numerator / denominator;
};

const compareNullableNumbers = (
    a: number | null,
    b: number | null,
    direction: 'asc' | 'desc'
): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return direction === 'asc' ? a - b : b - a;
};

const buildDriverLookup = (driverEntries: SessionDriverData[]): Map<number, InsightDriverRef> => {
    const map = new Map<number, InsightDriverRef>();
    driverEntries.forEach(entry => {
        map.set(entry.driverNumber, {
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
        });
    });
    return map;
};

type BuildRaceInsightsParams = {
    driverEntries: SessionDriverData[];
    overtakes: Overtake[];
    pitStops: PitStop[];
    raceControlSummary: RaceControlSummary;
};

const buildOvertakeInsights = (
    driverLookup: Map<number, InsightDriverRef>,
    overtakes: Overtake[]
): RaceInsights['overtakeLeaderboard'] => {
    const driverStats = new Map<number, OvertakeDriverInsight>();

    const ensureDriverStat = (driverNumber: number): OvertakeDriverInsight | null => {
        if (driverStats.has(driverNumber)) {
            return driverStats.get(driverNumber) ?? null;
        }
        const ref = driverLookup.get(driverNumber);
        if (!ref) return null;
        const stat: OvertakeDriverInsight = {
            ...ref,
            made: 0,
            suffered: 0,
            net: 0,
        };
        driverStats.set(driverNumber, stat);
        return stat;
    };

    overtakes.forEach(event => {
        const attacker = ensureDriverStat(event.overtakingDriverNumber);
        if (attacker) attacker.made += 1;

        const defender = ensureDriverStat(event.overtakenDriverNumber);
        if (defender) defender.suffered += 1;
    });

    const drivers = Array.from(driverStats.values())
        .map(stat => ({
            ...stat,
            net: stat.made - stat.suffered,
        }))
        .filter(stat => stat.made > 0 || stat.suffered > 0)
        .sort((a, b) => b.made - a.made || b.net - a.net || a.suffered - b.suffered);

    const teamMap = new Map<string, OvertakeTeamInsight>();
    drivers.forEach(stat => {
        const existing = teamMap.get(stat.teamName);
        if (existing) {
            existing.made += stat.made;
            existing.suffered += stat.suffered;
            existing.net = existing.made - existing.suffered;
            return;
        }

        teamMap.set(stat.teamName, {
            teamName: stat.teamName,
            teamColor: stat.teamColor,
            made: stat.made,
            suffered: stat.suffered,
            net: stat.net,
        });
    });

    const teams = Array.from(teamMap.values()).sort(
        (a, b) => b.made - a.made || b.net - a.net || a.suffered - b.suffered
    );

    return { drivers, teams };
};

const buildTyreDegradationInsights = (
    driverEntries: SessionDriverData[],
    safetyCarLapSet: Set<number>
): RaceInsights['tyreDegradation'] => {
    const stints: TyreDegradationInsight[] = [];

    driverEntries.forEach(entry => {
        const orderedStints = [...entry.stints].sort((a, b) => a.lap_start - b.lap_start);
        orderedStints.forEach(stint => {
            const durations = entry.laps
                .filter(
                    lap =>
                        lap.lap_number >= stint.lap_start &&
                        lap.lap_number <= stint.lap_end &&
                        !lap.is_pit_out_lap &&
                        !safetyCarLapSet.has(lap.lap_number) &&
                        isValidPositiveNumber(lap.lap_duration)
                )
                .map(lap => lap.lap_duration as number);

            if (durations.length < 4) {
                return;
            }

            const windowSize = Math.min(3, durations.length);
            const firstAvg = average(durations.slice(0, windowSize));
            const lastAvg = average(durations.slice(durations.length - windowSize));
            const delta = firstAvg != null && lastAvg != null ? lastAvg - firstAvg : null;

            stints.push({
                driverNumber: entry.driverNumber,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                teamColor: entry.driver.teamColor,
                compound: stint.compound,
                stintNumber: stint.stint_number,
                lapCount: durations.length,
                slope: slopePerLap(durations),
                deltaFirstToLast: delta,
            });
        });
    });

    stints.sort(
        (a, b) =>
            compareNullableNumbers(a.deltaFirstToLast, b.deltaFirstToLast, 'desc') ||
            compareNullableNumbers(a.slope, b.slope, 'desc')
    );

    return { stints };
};

const buildPitStrategyInsights = (
    driverEntries: SessionDriverData[],
    pitStops: PitStop[],
    safetyCarLapSet: Set<number>
): RaceInsights['pitStrategy'] => {
    const driverLookup = buildDriverLookup(driverEntries);
    const teamStatsMap = new Map<
        string,
        {
            teamName: string;
            teamColor?: string | null;
            durations: number[];
        }
    >();

    let fastestStop: FastestPitStopInsight | null = null;
    let safetyCarPitStops = 0;

    pitStops.forEach(stop => {
        if (!isValidPositiveNumber(stop.stop_duration)) return;

        if (safetyCarLapSet.has(stop.lap_number)) {
            safetyCarPitStops += 1;
        }

        const ref = driverLookup.get(stop.driver_number);
        if (!ref) return;

        const team = teamStatsMap.get(ref.teamName) ?? {
            teamName: ref.teamName,
            teamColor: ref.teamColor,
            durations: [],
        };
        team.durations.push(stop.stop_duration);
        teamStatsMap.set(ref.teamName, team);

        if (!fastestStop || stop.stop_duration < fastestStop.duration) {
            fastestStop = {
                ...ref,
                lap: stop.lap_number ?? null,
                duration: stop.stop_duration,
            };
        }
    });

    const teams: PitTeamInsight[] = Array.from(teamStatsMap.values())
        .map(team => ({
            teamName: team.teamName,
            teamColor: team.teamColor,
            stopCount: team.durations.length,
            medianStop: median(team.durations),
            averageStop: average(team.durations),
            fastestStop: team.durations.length ? Math.min(...team.durations) : null,
        }))
        .sort(
            (a, b) =>
                compareNullableNumbers(a.medianStop, b.medianStop, 'asc') ||
                compareNullableNumbers(a.averageStop, b.averageStop, 'asc')
        );

    const pitImpact: PitImpactInsight[] = [];
    driverEntries.forEach(entry => {
        const deltas: number[] = [];
        const orderedStops = [...entry.pitStops].sort((a, b) => a.lap_number - b.lap_number);

        orderedStops.forEach(stop => {
            const pre = entry.laps
                .filter(
                    lap =>
                        lap.lap_number >= stop.lap_number - 3 &&
                        lap.lap_number <= stop.lap_number - 1 &&
                        !lap.is_pit_out_lap &&
                        !safetyCarLapSet.has(lap.lap_number) &&
                        isValidPositiveNumber(lap.lap_duration)
                )
                .map(lap => lap.lap_duration as number);

            const post = entry.laps
                .filter(
                    lap =>
                        lap.lap_number >= stop.lap_number + 1 &&
                        lap.lap_number <= stop.lap_number + 3 &&
                        !lap.is_pit_out_lap &&
                        !safetyCarLapSet.has(lap.lap_number) &&
                        isValidPositiveNumber(lap.lap_duration)
                )
                .map(lap => lap.lap_duration as number);

            if (pre.length < 2 || post.length < 2) return;

            const preAvg = average(pre);
            const postAvg = average(post);
            if (preAvg == null || postAvg == null) return;
            deltas.push(postAvg - preAvg);
        });

        if (!deltas.length) return;

        pitImpact.push({
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
            stopCount: deltas.length,
            averageDelta: average(deltas),
        });
    });

    pitImpact.sort((a, b) => compareNullableNumbers(a.averageDelta, b.averageDelta, 'asc'));

    return {
        teams,
        fastestStop,
        safetyCarPitStops,
        pitImpact,
    };
};

const buildPaceConsistencyInsights = (
    driverEntries: SessionDriverData[],
    safetyCarLapSet: Set<number>
): RaceInsights['paceConsistency'] => {
    const drivers: PaceConsistencyInsight[] = [];

    driverEntries.forEach(entry => {
        const rawDurations = entry.laps
            .filter(
                lap =>
                    !lap.is_pit_out_lap &&
                    !safetyCarLapSet.has(lap.lap_number) &&
                    isValidPositiveNumber(lap.lap_duration)
            )
            .map(lap => lap.lap_duration as number);

        if (rawDurations.length < 5) return;

        const typical = median(rawDurations);
        const filteredDurations =
            typical == null
                ? rawDurations
                : rawDurations.filter(duration => duration <= typical * 1.08);

        const sample = filteredDurations.length >= 5 ? filteredDurations : rawDurations;
        const avg = average(sample);
        const sd = standardDeviation(sample);
        if (avg == null || sd == null || avg <= 0) return;

        drivers.push({
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
            lapCount: sample.length,
            averageLap: avg,
            standardDeviation: sd,
            coefficientOfVariation: (sd / avg) * 100,
        });
    });

    drivers.sort(
        (a, b) =>
            a.standardDeviation - b.standardDeviation ||
            a.coefficientOfVariation - b.coefficientOfVariation
    );

    return { drivers };
};

const buildPositionChangeInsights = (
    driverEntries: SessionDriverData[]
): RaceInsights['positionChanges'] => {
    const drivers: PositionGainInsight[] = [];

    driverEntries.forEach(entry => {
        const start = entry.startingPosition;
        const finish = entry.sessionResult?.position;
        if (!isValidPositiveNumber(start) || !isValidPositiveNumber(finish)) return;
        drivers.push({
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
            start,
            finish,
            gain: start - finish,
        });
    });

    drivers.sort((a, b) => b.gain - a.gain || a.finish - b.finish);

    const teamMap = new Map<string, TeamPositionGainInsight>();
    drivers.forEach(driver => {
        const existing = teamMap.get(driver.teamName);
        if (existing) {
            existing.netGain += driver.gain;
            return;
        }
        teamMap.set(driver.teamName, {
            teamName: driver.teamName,
            teamColor: driver.teamColor,
            netGain: driver.gain,
        });
    });

    const teams = Array.from(teamMap.values()).sort((a, b) => b.netGain - a.netGain);

    return { drivers, teams };
};

export const buildRaceInsights = ({
    driverEntries,
    overtakes,
    pitStops,
    raceControlSummary,
}: BuildRaceInsightsParams): RaceInsights => {
    const safetyCarLapSet = new Set(raceControlSummary.safetyCarLaps);
    const driverLookup = buildDriverLookup(driverEntries);

    return {
        overtakeLeaderboard: buildOvertakeInsights(driverLookup, overtakes),
        tyreDegradation: buildTyreDegradationInsights(driverEntries, safetyCarLapSet),
        pitStrategy: buildPitStrategyInsights(driverEntries, pitStops, safetyCarLapSet),
        paceConsistency: buildPaceConsistencyInsights(driverEntries, safetyCarLapSet),
        positionChanges: buildPositionChangeInsights(driverEntries),
    };
};

type BuildQualifyingInsightsParams = {
    driverEntries: SessionDriverData[];
    results: SessionResult[];
};

const getRoundDuration = (durations: number[], index: number): number | null => {
    const value = durations[index];
    return isValidPositiveNumber(value) ? value : null;
};

const buildQualifyingImprovementInsights = (
    driverEntries: SessionDriverData[],
    results: SessionResult[]
): QualifyingInsights['improvementIndex'] => {
    const resultMap = new Map(results.map(result => [result.driver_number, result]));
    const drivers: QualifyingImprovementInsight[] = [];

    driverEntries.forEach(entry => {
        const result = resultMap.get(entry.driverNumber);
        const durations = Array.isArray(result?.duration) ? result.duration : [];
        const q1 = getRoundDuration(durations, 0);
        const q2 = getRoundDuration(durations, 1);
        const q3 = getRoundDuration(durations, 2);

        const valid = [q1, q2, q3].filter((value): value is number => value != null);
        const best = valid.length ? Math.min(...valid) : null;

        drivers.push({
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
            q1,
            q2,
            q3,
            best,
            improvementToBest: q1 != null && best != null ? q1 - best : null,
            q1ToQ2: q1 != null && q2 != null ? q1 - q2 : null,
            q2ToQ3: q2 != null && q3 != null ? q2 - q3 : null,
        });
    });

    drivers.sort(
        (a, b) =>
            compareNullableNumbers(a.improvementToBest, b.improvementToBest, 'desc') ||
            compareNullableNumbers(a.q2ToQ3, b.q2ToQ3, 'desc')
    );

    return { drivers };
};

const buildSectorKingsInsights = (
    driverEntries: SessionDriverData[],
    results: SessionResult[]
): QualifyingInsights['sectorKings'] => {
    const resultMap = new Map(results.map(result => [result.driver_number, result]));
    const fastestSectors: {
        s1: QualifyingSectorRecord | null;
        s2: QualifyingSectorRecord | null;
        s3: QualifyingSectorRecord | null;
    } = {
        s1: null,
        s2: null,
        s3: null,
    };

    const idealLaps: QualifyingIdealLapInsight[] = [];

    driverEntries.forEach(entry => {
        let bestS1: number | null = null;
        let bestS2: number | null = null;
        let bestS3: number | null = null;
        let bestLapFromLaps: number | null = null;

        entry.laps.forEach(lap => {
            if (isValidPositiveNumber(lap.duration_sector_1)) {
                const sector1 = lap.duration_sector_1 as number;
                if (bestS1 == null || sector1 < bestS1) bestS1 = sector1;
                if (!fastestSectors.s1 || sector1 < fastestSectors.s1.time) {
                    fastestSectors.s1 = {
                        driverNumber: entry.driverNumber,
                        driverName: entry.driver.name,
                        teamName: entry.driver.team,
                        teamColor: entry.driver.teamColor,
                        sector: 1,
                        time: sector1,
                    };
                }
            }

            if (isValidPositiveNumber(lap.duration_sector_2)) {
                const sector2 = lap.duration_sector_2 as number;
                if (bestS2 == null || sector2 < bestS2) bestS2 = sector2;
                if (!fastestSectors.s2 || sector2 < fastestSectors.s2.time) {
                    fastestSectors.s2 = {
                        driverNumber: entry.driverNumber,
                        driverName: entry.driver.name,
                        teamName: entry.driver.team,
                        teamColor: entry.driver.teamColor,
                        sector: 2,
                        time: sector2,
                    };
                }
            }

            if (isValidPositiveNumber(lap.duration_sector_3)) {
                const sector3 = lap.duration_sector_3 as number;
                if (bestS3 == null || sector3 < bestS3) bestS3 = sector3;
                if (!fastestSectors.s3 || sector3 < fastestSectors.s3.time) {
                    fastestSectors.s3 = {
                        driverNumber: entry.driverNumber,
                        driverName: entry.driver.name,
                        teamName: entry.driver.team,
                        teamColor: entry.driver.teamColor,
                        sector: 3,
                        time: sector3,
                    };
                }
            }

            if (isValidPositiveNumber(lap.lap_duration)) {
                const lapDuration = lap.lap_duration as number;
                if (bestLapFromLaps == null || lapDuration < bestLapFromLaps) {
                    bestLapFromLaps = lapDuration;
                }
            }
        });

        const result = resultMap.get(entry.driverNumber);
        const resultDurations = Array.isArray(result?.duration) ? result.duration : [];
        const bestLapFromResults = [0, 1, 2]
            .map(index => getRoundDuration(resultDurations, index))
            .filter((value): value is number => value != null);
        const bestLap =
            bestLapFromResults.length > 0
                ? Math.min(...bestLapFromResults)
                : bestLapFromLaps;

        const idealLap =
            bestS1 != null && bestS2 != null && bestS3 != null ? bestS1 + bestS2 + bestS3 : null;
        const potentialGain =
            idealLap != null && bestLap != null ? bestLap - idealLap : null;

        idealLaps.push({
            driverNumber: entry.driverNumber,
            driverName: entry.driver.name,
            teamName: entry.driver.team,
            teamColor: entry.driver.teamColor,
            idealLap,
            bestLap,
            potentialGain,
        });
    });

    const driverWinsMap = new Map<number, QualifyingSectorWinInsight>();
    const teamWinsMap = new Map<string, QualifyingTeamSectorWinInsight>();
    [fastestSectors.s1, fastestSectors.s2, fastestSectors.s3].forEach(record => {
        if (!record) return;
        const existingDriver = driverWinsMap.get(record.driverNumber);
        if (existingDriver) {
            existingDriver.wins += 1;
        } else {
            driverWinsMap.set(record.driverNumber, {
                driverNumber: record.driverNumber,
                driverName: record.driverName,
                teamName: record.teamName,
                teamColor: record.teamColor,
                wins: 1,
            });
        }

        const existingTeam = teamWinsMap.get(record.teamName);
        if (existingTeam) {
            existingTeam.wins += 1;
        } else {
            teamWinsMap.set(record.teamName, {
                teamName: record.teamName,
                teamColor: record.teamColor,
                wins: 1,
            });
        }
    });

    const driverWins = Array.from(driverWinsMap.values()).sort((a, b) => b.wins - a.wins);
    const teamWins = Array.from(teamWinsMap.values()).sort((a, b) => b.wins - a.wins);
    idealLaps.sort(
        (a, b) =>
            compareNullableNumbers(a.idealLap, b.idealLap, 'asc') ||
            compareNullableNumbers(a.potentialGain, b.potentialGain, 'desc')
    );

    return {
        fastestSectors,
        driverWins,
        teamWins,
        idealLaps,
    };
};

export const buildQualifyingInsights = ({
    driverEntries,
    results,
}: BuildQualifyingInsightsParams): QualifyingInsights => ({
    improvementIndex: buildQualifyingImprovementInsights(driverEntries, results),
    sectorKings: buildSectorKingsInsights(driverEntries, results),
});
