import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRaceSessionDetail } from '../../../../backend/service/openf1Service';
import type { RaceSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { calculateAvgLapTimePerCompound } from '../../../../utils/lap';
import { formatLapTime } from '../../../../shared/time';
import { getTeamColorHex } from '../../../../utils/driver';
import { getCompoundName } from '../../../../utils/tyre';
import {
    average,
    FUEL_LOAD_ORDER,
    getCompoundOptions,
    getFuelLoadBounds,
    getFuelLoadForLap as resolveFuelLoadForLap,
    getRaceLapCount,
    isValidPositiveNumber,
    median,
    OVERALL_FILTER,
    standardDeviation,
    type FuelLoad,
} from './raceAnalytics';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

const EMPTY_SAFETY_CAR_LAPS: number[] = [];
type InsightViewMode = 'drivers' | 'teams';
type InsightDetailType = 'degradation' | 'racecraft' | 'consistency' | 'compoundPace' | 'pit';
type ConsistencyFilter = 'overall' | FuelLoad;
type RacecraftFilter = 'overtakes' | 'gains' | 'drops';
const FUEL_LOAD_LABEL: Record<FuelLoad, string> = {
    heavy: 'Heavy Fuel',
    medium: 'Medium Fuel',
    low: 'Low Fuel',
};

const RaceScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadRaceData = useCallback(async (): Promise<RaceSessionDetail> => {
        return getRaceSessionDetail(sessionKey);
    }, [sessionKey]);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<RaceSessionDetail>(loadRaceData, [loadRaceData]);

    const rows = data?.classification ?? [];
    const safetyCarLaps = data?.raceControlSummary.safetyCarLaps ?? EMPTY_SAFETY_CAR_LAPS;
    const safetyCarIntervals = data?.raceControlSummary.safetyCarIntervals ?? [];
    const driverEntries = data?.drivers ?? [];
    const raceInsights = data?.insights;
    const [selectedDriverPaceCompound, setSelectedDriverPaceCompound] =
        useState<string>(OVERALL_FILTER);
    const [selectedTeamPaceCompound, setSelectedTeamPaceCompound] =
        useState<string>(OVERALL_FILTER);
    const [selectedDriverTyreCompound, setSelectedDriverTyreCompound] =
        useState<string>(OVERALL_FILTER);
    const [selectedTeamTyreCompound, setSelectedTeamTyreCompound] =
        useState<string>(OVERALL_FILTER);
    const [selectedDriverConsistencyFilter, setSelectedDriverConsistencyFilter] =
        useState<ConsistencyFilter>(OVERALL_FILTER);
    const [selectedTeamConsistencyFilter, setSelectedTeamConsistencyFilter] =
        useState<ConsistencyFilter>(OVERALL_FILTER);
    const [selectedDriverRacecraftFilter, setSelectedDriverRacecraftFilter] =
        useState<RacecraftFilter>('overtakes');
    const [selectedTeamRacecraftFilter, setSelectedTeamRacecraftFilter] =
        useState<RacecraftFilter>('overtakes');
    const [insightViewMode, setInsightViewMode] = useState<InsightViewMode>('drivers');

    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const raceLapCount = useMemo(() => getRaceLapCount(rows, driverEntries), [rows, driverEntries]);

    const fuelLoadBounds = useMemo(
        () => getFuelLoadBounds(driverEntries, raceLapCount),
        [driverEntries, raceLapCount]
    );

    const totalRaceLapsDisplay =
        typeof raceLapCount === 'number' && raceLapCount > 0 ? raceLapCount : '–';

    const safetyCarLapCount = safetyCarLaps.length;

    const averagePitStopsPerDriver = useMemo(() => {
        if (!driverEntries.length) return null;
        const totalStops = driverEntries.reduce(
            (sum, entry) => sum + (entry.pitStops?.length ?? 0),
            0
        );
        return totalStops / driverEntries.length;
    }, [driverEntries]);

    const avgPitStopsDisplay =
        averagePitStopsPerDriver != null ? averagePitStopsPerDriver.toFixed(1) : '–';

    const defaultDriverNumber = useMemo(() => {
        if (rows.length && rows[0]?.driverNumber) {
            return rows[0].driverNumber;
        }
        return driverEntries[0]?.driverNumber ?? null;
    }, [rows, driverEntries]);

    const safetyCarEvents = useMemo(() => {
        if (!safetyCarIntervals.length) return [];
        return [...safetyCarIntervals]
            .sort((a, b) => a.start - b.start)
            .map((interval, index) => {
                const lapCount = Math.max(0, interval.end - interval.start + 1);
                const rangeLabel =
                    interval.start === interval.end
                        ? `Lap ${interval.start}`
                        : `Laps ${interval.start}–${interval.end}`;
                return {
                    index: index + 1,
                    rangeLabel,
                    lapCount,
                };
            });
    }, [safetyCarIntervals]);

    const compoundOptions = useMemo(() => getCompoundOptions(driverEntries), [driverEntries]);

    const compoundFilterOptions = useMemo(
        () => [OVERALL_FILTER, ...compoundOptions],
        [compoundOptions]
    );

    useEffect(() => {
        const normalize = (value: string) =>
            value === OVERALL_FILTER || compoundOptions.includes(value)
                ? value
                : OVERALL_FILTER;
        setSelectedDriverPaceCompound(normalize);
        setSelectedTeamPaceCompound(normalize);
        setSelectedDriverTyreCompound(normalize);
        setSelectedTeamTyreCompound(normalize);
    }, [compoundOptions]);

    useEffect(() => {
        setSelectedDriverRacecraftFilter('overtakes');
        setSelectedTeamRacecraftFilter('overtakes');
    }, [insightViewMode]);

    type DriverCompoundStat = {
        driverName: string;
        driverNumber: number;
        teamName: string;
        teamColor?: string | null;
        lapCount: number;
        avgTime: number;
    };

    const driverPaceByCompound = useMemo(() => {
        const map = new Map<string, DriverCompoundStat[]>();
        driverEntries.forEach(entry => {
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                excludedLapNumbers: safetyCarLapSet,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < 3) return;
                const compound = stat.compound.toUpperCase();
                const driverList = map.get(compound) ?? [];
                driverList.push({
                    driverName: entry.driver.name,
                    driverNumber: entry.driverNumber,
                    teamName: entry.driver.team,
                    teamColor: entry.driver.teamColor,
                    lapCount: stat.lapCount,
                    avgTime: stat.avgTime,
                });
                map.set(compound, driverList);
            });
        });
        compoundOptions.forEach(compound => {
            if (!map.has(compound)) {
                map.set(compound, []);
            }
        });
        map.forEach((list, compound) => {
            list.sort((a, b) => a.avgTime - b.avgTime);
            map.set(compound, list);
        });
        return map;
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

    type TeamCompoundStat = {
        teamName: string;
        avgTime: number;
        color?: string | null;
        lapCount: number;
    };

    const teamPaceByCompound = useMemo(() => {
        const compoundMap = new Map<
            string,
            Map<string, { total: number; count: number; color?: string | null }>
        >();
        driverEntries.forEach(entry => {
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                excludedLapNumbers: safetyCarLapSet,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < 3) return;
                const compound = stat.compound.toUpperCase();
                const teamName = entry.driver.team;
                const totalTime = stat.avgTime * stat.lapCount;
                const compoundTeams = compoundMap.get(compound) ?? new Map();
                const agg = compoundTeams.get(teamName) ?? {
                    total: 0,
                    count: 0,
                    color: entry.driver.teamColor,
                };
                compoundTeams.set(teamName, {
                    total: agg.total + totalTime,
                    count: agg.count + stat.lapCount,
                    color: agg.color ?? entry.driver.teamColor,
                });
                compoundMap.set(compound, compoundTeams);
            });
        });

        const result = new Map<string, TeamCompoundStat[]>();
        compoundOptions.forEach(compound => {
            const aggregate = compoundMap.get(compound);
            if (!aggregate) {
                result.set(compound, []);
                return;
            }
            const teams: TeamCompoundStat[] = [];
            aggregate.forEach((value, teamName) => {
                if (!value.count) return;
                const avg = value.total / value.count;
                if (!Number.isFinite(avg)) return;
                teams.push({
                    teamName,
                    avgTime: avg,
                    color: value.color,
                    lapCount: value.count,
                });
            });
            teams.sort((a, b) => a.avgTime - b.avgTime);
            result.set(compound, teams);
        });

        return result;
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

    const driverOverallPace = useMemo<DriverCompoundStat[]>(() => {
        const aggregate = new Map<
            number,
            {
                driverName: string;
                driverNumber: number;
                teamName: string;
                teamColor?: string | null;
                total: number;
                count: number;
            }
        >();

        driverPaceByCompound.forEach(entries => {
            entries.forEach(entry => {
                const existing = aggregate.get(entry.driverNumber) ?? {
                    driverName: entry.driverName,
                    driverNumber: entry.driverNumber,
                    teamName: entry.teamName,
                    teamColor: entry.teamColor,
                    total: 0,
                    count: 0,
                };
                existing.total += entry.avgTime * entry.lapCount;
                existing.count += entry.lapCount;
                existing.teamColor = existing.teamColor ?? entry.teamColor;
                aggregate.set(entry.driverNumber, existing);
            });
        });

        const rows: DriverCompoundStat[] = [];
        aggregate.forEach(entry => {
            if (!entry.count) return;
            rows.push({
                driverName: entry.driverName,
                driverNumber: entry.driverNumber,
                teamName: entry.teamName,
                teamColor: entry.teamColor,
                lapCount: entry.count,
                avgTime: entry.total / entry.count,
            });
        });

        rows.sort((a, b) => a.avgTime - b.avgTime);
        return rows;
    }, [driverPaceByCompound]);

    const teamOverallPace = useMemo<TeamCompoundStat[]>(() => {
        const aggregate = new Map<
            string,
            { teamName: string; color?: string | null; total: number; count: number }
        >();

        teamPaceByCompound.forEach(entries => {
            entries.forEach(entry => {
                const existing = aggregate.get(entry.teamName) ?? {
                    teamName: entry.teamName,
                    color: entry.color,
                    total: 0,
                    count: 0,
                };
                existing.total += entry.avgTime * entry.lapCount;
                existing.count += entry.lapCount;
                existing.color = existing.color ?? entry.color;
                aggregate.set(entry.teamName, existing);
            });
        });

        const rows: TeamCompoundStat[] = [];
        aggregate.forEach(entry => {
            if (!entry.count) return;
            rows.push({
                teamName: entry.teamName,
                avgTime: entry.total / entry.count,
                color: entry.color,
                lapCount: entry.count,
            });
        });
        rows.sort((a, b) => a.avgTime - b.avgTime);
        return rows;
    }, [teamPaceByCompound]);

    const overtakeDriverLeaders = raceInsights?.overtakeLeaderboard.drivers ?? [];
    const overtakeTeamLeaders = raceInsights?.overtakeLeaderboard.teams ?? [];
    const degradationLeaders = raceInsights?.tyreDegradation.stints ?? [];
    const pitTeamInsights = raceInsights?.pitStrategy.teams ?? [];
    const pitImpactInsights = raceInsights?.pitStrategy.pitImpact ?? [];
    const consistencyInsights = raceInsights?.paceConsistency.drivers ?? [];
    const positionChangeInsights = raceInsights?.positionChanges.drivers ?? [];
    const teamPositionChanges = raceInsights?.positionChanges.teams ?? [];
    const isTeamInsightsMode = insightViewMode === 'teams';

    type TeamConsistencyInsight = {
        teamName: string;
        driverCount: number;
        lapCount: number;
        standardDeviation: number;
        coefficientOfVariation: number;
    };

    const getFuelLoadForLap = useCallback(
        (lapNumber: number): FuelLoad => {
            return resolveFuelLoadForLap(lapNumber, fuelLoadBounds);
        },
        [fuelLoadBounds]
    );

    const teamConsistencyInsights = useMemo<TeamConsistencyInsight[]>(() => {
        const teamSamples = new Map<
            string,
            { teamName: string; driverCount: number; durations: number[] }
        >();

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

            if (sample.length < 5) return;

            const teamName = entry.driver.team;
            const existing = teamSamples.get(teamName) ?? {
                teamName,
                driverCount: 0,
                durations: [],
            };
            existing.driverCount += 1;
            existing.durations.push(...sample);
            teamSamples.set(teamName, existing);
        });

        const teams: TeamConsistencyInsight[] = [];
        teamSamples.forEach(team => {
            if (team.durations.length < 5) return;
            const avg = average(team.durations);
            const sd = standardDeviation(team.durations);
            if (avg == null || sd == null || avg <= 0) return;
            teams.push({
                teamName: team.teamName,
                driverCount: team.driverCount,
                lapCount: team.durations.length,
                standardDeviation: sd,
                coefficientOfVariation: (sd / avg) * 100,
            });
        });

        teams.sort(
            (a, b) =>
                a.standardDeviation - b.standardDeviation ||
                a.coefficientOfVariation - b.coefficientOfVariation
        );

        return teams;
    }, [driverEntries, safetyCarLapSet]);

    type TeamFuelConsistencyInsight = TeamConsistencyInsight & {
        fuelLoad: FuelLoad;
    };

    const teamConsistencyByFuelLoad = useMemo<Record<FuelLoad, TeamFuelConsistencyInsight[]>>(() => {
        const fuelMaps: Record<
            FuelLoad,
            Map<string, { teamName: string; driverNumbers: Set<number>; durations: number[] }>
        > = {
            heavy: new Map(),
            medium: new Map(),
            low: new Map(),
        };

        driverEntries.forEach(entry => {
            const rawLaps = entry.laps
                .filter(
                    lap =>
                        !lap.is_pit_out_lap &&
                        !safetyCarLapSet.has(lap.lap_number) &&
                        isValidPositiveNumber(lap.lap_duration)
                )
                .map(lap => ({
                    lapNumber: lap.lap_number,
                    duration: lap.lap_duration as number,
                }));

            if (rawLaps.length < 5) return;

            const typical = median(rawLaps.map(lap => lap.duration));
            const filteredLaps =
                typical == null
                    ? rawLaps
                    : rawLaps.filter(lap => lap.duration <= typical * 1.08);
            const sampleLaps = filteredLaps.length >= 5 ? filteredLaps : rawLaps;

            if (sampleLaps.length < 5) return;

            sampleLaps.forEach(lap => {
                const fuelLoad = getFuelLoadForLap(lap.lapNumber);
                const teamBucket = fuelMaps[fuelLoad];
                const teamName = entry.driver.team;
                const existing = teamBucket.get(teamName) ?? {
                    teamName,
                    driverNumbers: new Set<number>(),
                    durations: [],
                };

                existing.driverNumbers.add(entry.driverNumber);
                existing.durations.push(lap.duration);
                teamBucket.set(teamName, existing);
            });
        });

        const toSortedInsights = (fuelLoad: FuelLoad): TeamFuelConsistencyInsight[] => {
            const insights: TeamFuelConsistencyInsight[] = [];
            fuelMaps[fuelLoad].forEach(team => {
                if (team.durations.length < 3) return;
                const avg = average(team.durations);
                const sd = standardDeviation(team.durations);
                if (avg == null || sd == null || avg <= 0) return;
                insights.push({
                    fuelLoad,
                    teamName: team.teamName,
                    driverCount: team.driverNumbers.size,
                    lapCount: team.durations.length,
                    standardDeviation: sd,
                    coefficientOfVariation: (sd / avg) * 100,
                });
            });

            insights.sort(
                (a, b) =>
                    a.standardDeviation - b.standardDeviation ||
                    a.coefficientOfVariation - b.coefficientOfVariation
            );

            return insights;
        };

        return {
            heavy: toSortedInsights('heavy'),
            medium: toSortedInsights('medium'),
            low: toSortedInsights('low'),
        };
    }, [driverEntries, getFuelLoadForLap, safetyCarLapSet]);

    type DriverFuelConsistencyInsight = {
        fuelLoad: FuelLoad;
        driverNumber: number;
        driverName: string;
        teamName: string;
        lapCount: number;
        standardDeviation: number;
        coefficientOfVariation: number;
    };

    const driverConsistencyByFuelLoad = useMemo<Record<FuelLoad, DriverFuelConsistencyInsight[]>>(() => {
        const buckets: Record<FuelLoad, DriverFuelConsistencyInsight[]> = {
            heavy: [],
            medium: [],
            low: [],
        };

        driverEntries.forEach(entry => {
            const rawLaps = entry.laps
                .filter(
                    lap =>
                        !lap.is_pit_out_lap &&
                        !safetyCarLapSet.has(lap.lap_number) &&
                        isValidPositiveNumber(lap.lap_duration)
                )
                .map(lap => ({
                    lapNumber: lap.lap_number,
                    duration: lap.lap_duration as number,
                }));

            if (rawLaps.length < 5) return;
            const typical = median(rawLaps.map(lap => lap.duration));
            const filtered =
                typical == null
                    ? rawLaps
                    : rawLaps.filter(lap => lap.duration <= typical * 1.08);
            const sample = filtered.length >= 5 ? filtered : rawLaps;
            if (sample.length < 5) return;

            FUEL_LOAD_ORDER.forEach(fuelLoad => {
                const durations = sample
                    .filter(lap => getFuelLoadForLap(lap.lapNumber) === fuelLoad)
                    .map(lap => lap.duration);
                if (durations.length < 3) return;
                const avg = average(durations);
                const sd = standardDeviation(durations);
                if (avg == null || sd == null || avg <= 0) return;
                buckets[fuelLoad].push({
                    fuelLoad,
                    driverNumber: entry.driverNumber,
                    driverName: entry.driver.name,
                    teamName: entry.driver.team,
                    lapCount: durations.length,
                    standardDeviation: sd,
                    coefficientOfVariation: (sd / avg) * 100,
                });
            });
        });

        FUEL_LOAD_ORDER.forEach(fuelLoad => {
            buckets[fuelLoad].sort(
                (a, b) =>
                    a.standardDeviation - b.standardDeviation ||
                    a.coefficientOfVariation - b.coefficientOfVariation
            );
        });

        return buckets;
    }, [driverEntries, getFuelLoadForLap, safetyCarLapSet]);

    type TeamTyreDegradationInsight = {
        teamName: string;
        teamColor?: string | null;
        stintCount: number;
        lapCount: number;
        averageSlope: number | null;
        averageDeltaFirstToLast: number | null;
    };

    type DriverTyreDegradationInsight = {
        driverNumber: number;
        driverName: string;
        teamName: string;
        teamColor?: string | null;
        stintCount: number;
        lapCount: number;
        averageSlope: number | null;
        averageDeltaFirstToLast: number | null;
    };

    const buildTeamDegradationInsights = useCallback(
        (entries: (typeof degradationLeaders)[number][]) => {
            const teamMap = new Map<
                string,
                {
                    teamName: string;
                    teamColor?: string | null;
                    stintCount: number;
                    lapCount: number;
                    slopeWeightedTotal: number;
                    slopeWeight: number;
                    deltaWeightedTotal: number;
                    deltaWeight: number;
                }
            >();

            entries.forEach(entry => {
                const team = teamMap.get(entry.teamName) ?? {
                    teamName: entry.teamName,
                    teamColor: entry.teamColor,
                    stintCount: 0,
                    lapCount: 0,
                    slopeWeightedTotal: 0,
                    slopeWeight: 0,
                    deltaWeightedTotal: 0,
                    deltaWeight: 0,
                };

                team.stintCount += 1;
                team.lapCount += entry.lapCount;

                if (typeof entry.slope === 'number' && Number.isFinite(entry.slope)) {
                    team.slopeWeightedTotal += entry.slope * entry.lapCount;
                    team.slopeWeight += entry.lapCount;
                }

                if (
                    typeof entry.deltaFirstToLast === 'number' &&
                    Number.isFinite(entry.deltaFirstToLast)
                ) {
                    team.deltaWeightedTotal += entry.deltaFirstToLast * entry.lapCount;
                    team.deltaWeight += entry.lapCount;
                }

                team.teamColor = team.teamColor ?? entry.teamColor;
                teamMap.set(entry.teamName, team);
            });

            const teams: TeamTyreDegradationInsight[] = [];
            teamMap.forEach(team => {
                teams.push({
                    teamName: team.teamName,
                    teamColor: team.teamColor,
                    stintCount: team.stintCount,
                    lapCount: team.lapCount,
                    averageSlope:
                        team.slopeWeight > 0 ? team.slopeWeightedTotal / team.slopeWeight : null,
                    averageDeltaFirstToLast:
                        team.deltaWeight > 0 ? team.deltaWeightedTotal / team.deltaWeight : null,
                });
            });

            teams.sort((a, b) => {
                if (a.averageDeltaFirstToLast == null && b.averageDeltaFirstToLast == null) {
                    return 0;
                }
                if (a.averageDeltaFirstToLast == null) return 1;
                if (b.averageDeltaFirstToLast == null) return -1;
                const deltaDiff = a.averageDeltaFirstToLast - b.averageDeltaFirstToLast;
                if (deltaDiff !== 0) return deltaDiff;
                if (a.averageSlope == null && b.averageSlope == null) return 0;
                if (a.averageSlope == null) return 1;
                if (b.averageSlope == null) return -1;
                return a.averageSlope - b.averageSlope;
            });

            return teams;
        },
        []
    );

    const teamDegradationInsights = useMemo<TeamTyreDegradationInsight[]>(() => {
        return buildTeamDegradationInsights(degradationLeaders);
    }, [buildTeamDegradationInsights, degradationLeaders]);

    const buildDriverDegradationInsights = useCallback(
        (entries: (typeof degradationLeaders)[number][]) => {
            const driverMap = new Map<
                number,
                {
                    driverNumber: number;
                    driverName: string;
                    teamName: string;
                    teamColor?: string | null;
                    stintCount: number;
                    lapCount: number;
                    slopeWeightedTotal: number;
                    slopeWeight: number;
                    deltaWeightedTotal: number;
                    deltaWeight: number;
                }
            >();

            entries.forEach(entry => {
                const driver = driverMap.get(entry.driverNumber) ?? {
                    driverNumber: entry.driverNumber,
                    driverName: entry.driverName,
                    teamName: entry.teamName,
                    teamColor: entry.teamColor,
                    stintCount: 0,
                    lapCount: 0,
                    slopeWeightedTotal: 0,
                    slopeWeight: 0,
                    deltaWeightedTotal: 0,
                    deltaWeight: 0,
                };

                driver.stintCount += 1;
                driver.lapCount += entry.lapCount;

                if (typeof entry.slope === 'number' && Number.isFinite(entry.slope)) {
                    driver.slopeWeightedTotal += entry.slope * entry.lapCount;
                    driver.slopeWeight += entry.lapCount;
                }

                if (
                    typeof entry.deltaFirstToLast === 'number' &&
                    Number.isFinite(entry.deltaFirstToLast)
                ) {
                    driver.deltaWeightedTotal += entry.deltaFirstToLast * entry.lapCount;
                    driver.deltaWeight += entry.lapCount;
                }

                driver.teamColor = driver.teamColor ?? entry.teamColor;
                driverMap.set(entry.driverNumber, driver);
            });

            const drivers: DriverTyreDegradationInsight[] = [];
            driverMap.forEach(driver => {
                drivers.push({
                    driverNumber: driver.driverNumber,
                    driverName: driver.driverName,
                    teamName: driver.teamName,
                    teamColor: driver.teamColor,
                    stintCount: driver.stintCount,
                    lapCount: driver.lapCount,
                    averageSlope:
                        driver.slopeWeight > 0
                            ? driver.slopeWeightedTotal / driver.slopeWeight
                            : null,
                    averageDeltaFirstToLast:
                        driver.deltaWeight > 0
                            ? driver.deltaWeightedTotal / driver.deltaWeight
                            : null,
                });
            });

            drivers.sort((a, b) => {
                if (a.averageDeltaFirstToLast == null && b.averageDeltaFirstToLast == null) {
                    return 0;
                }
                if (a.averageDeltaFirstToLast == null) return 1;
                if (b.averageDeltaFirstToLast == null) return -1;
                const deltaDiff = a.averageDeltaFirstToLast - b.averageDeltaFirstToLast;
                if (deltaDiff !== 0) return deltaDiff;
                if (a.averageSlope == null && b.averageSlope == null) return 0;
                if (a.averageSlope == null) return 1;
                if (b.averageSlope == null) return -1;
                return a.averageSlope - b.averageSlope;
            });

            return drivers;
        },
        []
    );

    const driverDegradationInsights = useMemo<DriverTyreDegradationInsight[]>(() => {
        return buildDriverDegradationInsights(degradationLeaders);
    }, [buildDriverDegradationInsights, degradationLeaders]);

    const driverDegradationByCompound = useMemo(() => {
        const map = new Map<string, DriverTyreDegradationInsight[]>();
        compoundOptions.forEach(compound => {
            const filtered = degradationLeaders.filter(
                entry => entry.compound?.toUpperCase() === compound
            );
            map.set(compound, buildDriverDegradationInsights(filtered));
        });
        return map;
    }, [buildDriverDegradationInsights, compoundOptions, degradationLeaders]);

    const teamDegradationByCompound = useMemo(() => {
        const map = new Map<string, TeamTyreDegradationInsight[]>();
        compoundOptions.forEach(compound => {
            const filtered = degradationLeaders.filter(
                entry => entry.compound?.toUpperCase() === compound
            );
            map.set(compound, buildTeamDegradationInsights(filtered));
        });
        return map;
    }, [buildTeamDegradationInsights, compoundOptions, degradationLeaders]);

    type FastestPitStop = {
        duration: number;
        team: string;
        driver: string;
        lap: number | null;
    };

    type FastestRaceLap = {
        lapTime: number;
        lapNumber: number;
        driverName: string;
        driverNumber: number;
        teamName: string;
        teamColor?: string | null;
    };

    const fastestRaceLap = useMemo<FastestRaceLap | null>(() => {
        let record: FastestRaceLap | null = null;
        driverEntries.forEach(entry => {
            entry.laps.forEach(lap => {
                if (!isValidPositiveNumber(lap.lap_duration) || lap.lap_number <= 0) {
                    return;
                }
                if (
                    !record ||
                    lap.lap_duration < record.lapTime ||
                    (lap.lap_duration === record.lapTime && lap.lap_number < record.lapNumber)
                ) {
                    record = {
                        lapTime: lap.lap_duration,
                        lapNumber: lap.lap_number,
                        driverName: entry.driver.name,
                        driverNumber: entry.driverNumber,
                        teamName: entry.driver.team,
                        teamColor: entry.driver.teamColor,
                    };
                }
            });
        });
        return record;
    }, [driverEntries]);

    const fastestPitStop = useMemo<FastestPitStop | null>(() => {
        let record: FastestPitStop | null = null;
        driverEntries.forEach(entry => {
            entry.pitStops?.forEach(stop => {
                if (typeof stop.stop_duration !== 'number' || stop.stop_duration <= 0) {
                    return;
                }
                if (!record || stop.stop_duration < record.duration) {
                    record = {
                        duration: stop.stop_duration,
                        team: entry.driver.team,
                        driver: entry.driver.name,
                        lap: stop.lap_number ?? null,
                    };
                }
            });
        });
        return record;
    }, [driverEntries]);

    const positionsGainedLeader = useMemo<{
        driverName: string;
        teamName: string;
        gain: number;
        start: number;
        finish: number;
    } | null>(() => {
        // Break ties by choosing the driver who finished higher overall
        let leader: {
            driverName: string;
            teamName: string;
            gain: number;
            start: number;
            finish: number;
        } | null = null;

        driverEntries.forEach(entry => {
            const start = entry.startingPosition;
            const finish = entry.sessionResult?.position;
            if (
                typeof start !== 'number' ||
                typeof finish !== 'number' ||
                start <= 0 ||
                finish <= 0
            ) {
                return;
            }
            const gain = start - finish;
            if (gain <= 0) {
                return;
            }
            if (
                !leader ||
                gain > leader.gain ||
                (gain === leader.gain && finish < leader.finish)
            ) {
                leader = {
                    driverName: entry.driver.name,
                    teamName: entry.driver.team,
                    gain,
                    start,
                    finish,
                };
            }
        });

        return leader;
    }, [driverEntries]);

    const insightsMetrics = [
        { label: 'Race Laps', value: totalRaceLapsDisplay },
        { label: 'SC Laps', value: safetyCarLapCount || '0' },
        { label: 'Avg Pit Stops', value: avgPitStopsDisplay },
    ];

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('RaceClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const handleOpenOvertakes = useCallback(() => {
        navigation.navigate('RaceOvertakes', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const openDriverOverview = useCallback(
        (driverNumber: number | null | undefined) => {
            if (typeof driverNumber !== 'number') return;
            navigation.navigate('DriverOverview', {
                driverNumber,
                sessionKey,
            });
        },
        [navigation, sessionKey]
    );

    const handleOpenDriverData = useCallback(() => {
        openDriverOverview(defaultDriverNumber);
    }, [defaultDriverNumber, openDriverOverview]);

    const handleOpenInsightDetails = useCallback(
        (detailType: InsightDetailType) => {
            const initialFilter =
                detailType === 'degradation'
                    ? isTeamInsightsMode
                        ? selectedTeamTyreCompound
                        : selectedDriverTyreCompound
                    : detailType === 'compoundPace'
                    ? isTeamInsightsMode
                        ? selectedTeamPaceCompound
                        : selectedDriverPaceCompound
                    : detailType === 'consistency'
                    ? isTeamInsightsMode
                        ? selectedTeamConsistencyFilter
                        : selectedDriverConsistencyFilter
                    : detailType === 'racecraft'
                    ? isTeamInsightsMode
                        ? selectedTeamRacecraftFilter
                        : selectedDriverRacecraftFilter
                    : undefined;
            navigation.navigate('RacePaceInsights', {
                sessionKey,
                sessionName,
                meetingName,
                initialViewMode: insightViewMode,
                detailType,
                initialFilter,
            });
        },
        [
            insightViewMode,
            isTeamInsightsMode,
            meetingName,
            navigation,
            selectedDriverConsistencyFilter,
            selectedDriverRacecraftFilter,
            selectedDriverPaceCompound,
            selectedDriverTyreCompound,
            selectedTeamConsistencyFilter,
            selectedTeamRacecraftFilter,
            selectedTeamPaceCompound,
            selectedTeamTyreCompound,
            sessionKey,
            sessionName,
        ]
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading race data...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const session = data;
    const heroDate =
        session &&
        new Date(session.date_start).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });

    const formatPace = (value?: number | null) =>
        typeof value === 'number' && value > 0 ? formatLapTime(value) : '—';
    const formatSignedSeconds = (value?: number | null) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '—';
        const prefix = value > 0 ? '+' : '';
        return `${prefix}${value.toFixed(3)}s`;
    };

    const activeTyreCompoundFilter = isTeamInsightsMode
        ? selectedTeamTyreCompound
        : selectedDriverTyreCompound;
    const activeTyreCompoundName =
        activeTyreCompoundFilter === OVERALL_FILTER
            ? 'Overall'
            : getCompoundName(activeTyreCompoundFilter);
    const activeTeamDegradationEntries =
        activeTyreCompoundFilter === OVERALL_FILTER
            ? teamDegradationInsights
            : teamDegradationByCompound.get(activeTyreCompoundFilter) ?? [];
    const activeDriverDegradationEntries =
        activeTyreCompoundFilter === OVERALL_FILTER
            ? driverDegradationInsights
            : driverDegradationByCompound.get(activeTyreCompoundFilter) ?? [];
    const topTeamDegradationEntries = activeTeamDegradationEntries.slice(0, 3);
    const topDriverDegradationEntries = activeDriverDegradationEntries.slice(0, 3);
    const bestTeamDegradationEntry = topTeamDegradationEntries[0] ?? null;
    const bestDriverDegradationEntry = topDriverDegradationEntries[0] ?? null;

    const activePaceCompoundFilter = isTeamInsightsMode
        ? selectedTeamPaceCompound
        : selectedDriverPaceCompound;
    const activePaceCompoundName =
        activePaceCompoundFilter === OVERALL_FILTER
            ? 'Overall'
            : getCompoundName(activePaceCompoundFilter);
    const activeTeamPaceEntries =
        activePaceCompoundFilter === OVERALL_FILTER
            ? teamOverallPace
            : teamPaceByCompound.get(activePaceCompoundFilter) ?? [];
    const activeDriverPaceEntries =
        activePaceCompoundFilter === OVERALL_FILTER
            ? driverOverallPace
            : driverPaceByCompound.get(activePaceCompoundFilter) ?? [];
    const topTeamPaceEntries = activeTeamPaceEntries.slice(0, 3);
    const topDriverPaceEntries = activeDriverPaceEntries.slice(0, 3);

    const activeConsistencyFilter = isTeamInsightsMode
        ? selectedTeamConsistencyFilter
        : selectedDriverConsistencyFilter;
    const activeConsistencyLabel =
        activeConsistencyFilter === OVERALL_FILTER
            ? 'Overall'
            : FUEL_LOAD_LABEL[activeConsistencyFilter];
    const activeTeamConsistencyEntries =
        activeConsistencyFilter === OVERALL_FILTER
            ? teamConsistencyInsights
            : teamConsistencyByFuelLoad[activeConsistencyFilter];
    const activeDriverConsistencyEntries =
        activeConsistencyFilter === OVERALL_FILTER
            ? consistencyInsights
            : driverConsistencyByFuelLoad[activeConsistencyFilter];
    const topTeamConsistencyEntries = activeTeamConsistencyEntries.slice(0, 3);
    const topDriverConsistencyEntries = activeDriverConsistencyEntries.slice(0, 3);

    const topTeamOvertakeEntries = overtakeTeamLeaders.slice(0, 3);
    const topDriverOvertakeEntries = overtakeDriverLeaders.slice(0, 3);
    const topTeamPositionGainEntries = teamPositionChanges.slice(0, 3);
    const topDriverPositionGainEntries = positionChangeInsights.slice(0, 3);
    const topTeamPositionDropEntries = [...teamPositionChanges]
        .sort((a, b) => a.netGain - b.netGain)
        .filter(entry => entry.netGain < 0)
        .slice(0, 3);
    const topDriverPositionDropEntries = [...positionChangeInsights]
        .sort((a, b) => a.gain - b.gain)
        .filter(entry => entry.gain < 0)
        .slice(0, 3);
    const activeRacecraftFilter = isTeamInsightsMode
        ? selectedTeamRacecraftFilter
        : selectedDriverRacecraftFilter;
    const racecraftFilterLabel: Record<RacecraftFilter, string> = {
        overtakes: 'Overtakes (Net)',
        gains: 'Position Gains',
        drops: 'Position Drops',
    };

    const bestPitImpact = pitImpactInsights.length ? pitImpactInsights[0] : null;
    const worstPitImpact = pitImpactInsights.length
        ? pitImpactInsights[pitImpactInsights.length - 1]
        : null;

    const heroStats = [
        { label: 'Drivers', value: driverEntries.length || '–' },
        { label: 'SC Laps', value: safetyCarLapCount || '0' },
        { label: 'Laps', value: totalRaceLapsDisplay },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <Text style={styles.heroSubtitle}>{meetingName || session?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {heroDate && <Text style={styles.heroDate}>{heroDate}</Text>}
                    <View style={styles.chipRow}>
                        {session?.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{session.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        {session?.country_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{session.country_name}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                <View style={styles.heroStats}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    activeOpacity={0.9}
                    onPress={handleOpenClassification}
                >
                    <Text style={styles.actionButtonText}>Race Classification</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {rows.length || 0} {rows.length === 1 ? 'driver' : 'drivers'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        styles.actionButtonSecondary,
                        !defaultDriverNumber && styles.actionButtonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleOpenDriverData}
                    disabled={!defaultDriverNumber}
                >
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>Driver Data</Text>
                    <Text style={[styles.actionButtonSubtitle, styles.actionButtonSubtitleDark]}>
                        Dive into driver telemetry & laps
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={styles.actionRowSingle}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        styles.actionButtonTertiary,
                        !(data?.overtakes?.length ?? 0) && styles.actionButtonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleOpenOvertakes}
                    disabled={!(data?.overtakes?.length ?? 0)}
                >
                    <Text style={styles.actionButtonText}>Overtakes</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {(data?.overtakes?.length ?? 0)} recorded passes
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.insightsCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Race Snapshot</Text>
                    <Text style={styles.cardTitle}>Strategy & Safety</Text>
                    <Text style={styles.cardSubtitle}>
                        Key metrics tracked live from timing data
                    </Text>
                </View>
                <View style={styles.metricRow}>
                    {insightsMetrics.map(metric => (
                        <View key={metric.label} style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metric.value}</Text>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                        </View>
                    ))}
                </View>
                {positionsGainedLeader ? (
                    <View style={styles.climberCard}>
                        <View style={styles.climberBadge}>
                            <Text style={styles.climberBadgeText}>Biggest Climber</Text>
                        </View>
                        <Text style={styles.climberDriver}>{positionsGainedLeader.driverName}</Text>
                        <Text style={styles.climberMeta}>
                            +{positionsGainedLeader.gain} positions • started P
                            {positionsGainedLeader.start} → finished P{positionsGainedLeader.finish}
                        </Text>
                        <Text style={styles.climberTeam}>{positionsGainedLeader.teamName}</Text>
                    </View>
                ) : null}
                <View style={styles.fastestPitCard}>
                    <View>
                        <Text style={styles.fastestPitLabel}>Fastest Pit Stop</Text>
                        <Text style={styles.fastestPitValue}>
                            {fastestPitStop ? `${fastestPitStop.duration.toFixed(2)}s` : '—'}
                        </Text>
                    </View>
                    <View style={styles.fastestPitMetaBlock}>
                        <Text style={styles.fastestPitMeta}>
                            {fastestPitStop ? fastestPitStop.team : 'No team data yet'}
                        </Text>
                        {fastestPitStop ? (
                            <Text style={styles.fastestPitMetaSecondary}>
                                {fastestPitStop.driver}
                                {fastestPitStop.lap ? ` • Lap ${fastestPitStop.lap}` : ''}
                            </Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.fastestLapCard}>
                    <View>
                        <Text style={styles.fastestLapLabel}>Fastest Lap</Text>
                        <Text style={styles.fastestLapValue}>
                            {fastestRaceLap ? formatLapTime(fastestRaceLap.lapTime) : '—'}
                        </Text>
                    </View>
                    <View style={styles.fastestLapMetaBlock}>
                        {fastestRaceLap ? (
                            <>
                                <View style={styles.fastestLapDriverRow}>
                                    <View
                                        style={[
                                            styles.teamDot,
                                            styles.fastestLapTeamDot,
                                            {
                                                backgroundColor: getTeamColorHex(
                                                    fastestRaceLap.teamColor
                                                ),
                                            },
                                        ]}
                                    />
                                    <Text style={styles.fastestLapMeta}>
                                        {fastestRaceLap.driverName}
                                    </Text>
                                </View>
                                <Text style={styles.fastestLapMetaSecondary}>
                                    {fastestRaceLap.teamName} • #{fastestRaceLap.driverNumber} • Lap{' '}
                                    {fastestRaceLap.lapNumber}
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.fastestLapMeta}>No lap data yet</Text>
                        )}
                    </View>
                </View>
                <View style={styles.safetyCarCard}>
                    <View style={styles.safetyCarHeader}>
                        <Text style={styles.safetyCarTitle}>Safety Car Summary</Text>
                        <View
                            style={[
                                styles.safetyCarBadge,
                                safetyCarEvents.length
                                    ? styles.safetyCarBadgeActive
                                    : styles.safetyCarBadgeInactive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.safetyCarBadgeText,
                                    safetyCarEvents.length
                                        ? styles.safetyCarBadgeTextActive
                                        : styles.safetyCarBadgeTextInactive,
                                ]}
                            >
                                {safetyCarEvents.length
                                    ? `${safetyCarEvents.length} ${
                                          safetyCarEvents.length === 1 ? 'Deployment' : 'Deployments'
                                      }`
                                    : 'No Deployments'}
                            </Text>
                        </View>
                    </View>
                    {safetyCarEvents.length ? (
                        <>
                            <Text style={styles.safetyCarMeta}>
                                Total SC laps: {safetyCarLapCount || 0}
                            </Text>
                            {safetyCarEvents.map(event => (
                                <View key={`sc-${event.index}`} style={styles.safetyCarRow}>
                                    <View>
                                        <Text style={styles.safetyCarRowLabel}>SC #{event.index}</Text>
                                        <Text style={styles.safetyCarRowRange}>{event.rangeLabel}</Text>
                                    </View>
                                    <Text style={styles.safetyCarRowCount}>
                                        {event.lapCount}{' '}
                                        {event.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.noSafetyCarText}>
                            Timing data indicates no safety car periods.
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.insightModeCard}>
                <Text style={styles.insightModeLabel}>Insights View</Text>
                <View style={styles.insightModeOptions}>
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            insightViewMode === 'teams' && styles.filterChipActive,
                        ]}
                        onPress={() => setInsightViewMode('teams')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                insightViewMode === 'teams' && styles.filterChipLabelActive,
                            ]}
                        >
                            Teams
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            insightViewMode === 'drivers' && styles.filterChipActive,
                        ]}
                        onPress={() => setInsightViewMode('drivers')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                insightViewMode === 'drivers' && styles.filterChipLabelActive,
                            ]}
                        >
                            Drivers
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Racecraft Story</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? `Top 3 teams for ${racecraftFilterLabel[activeRacecraftFilter].toLowerCase()}`
                            : `Top 3 drivers for ${racecraftFilterLabel[activeRacecraftFilter].toLowerCase()}`}
                    </Text>
                </View>
                <Text style={styles.sectionStoryText}>
                    Overtake net = made - suffered. Position gain = start - finish (positive is
                    better). Position drops are negative values.
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                >
                    {(['overtakes', 'gains', 'drops'] as RacecraftFilter[]).map(filter => {
                        const active = filter === activeRacecraftFilter;
                        return (
                            <TouchableOpacity
                                key={`racecraft-filter-${filter}`}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => {
                                    if (isTeamInsightsMode) {
                                        setSelectedTeamRacecraftFilter(filter);
                                    } else {
                                        setSelectedDriverRacecraftFilter(filter);
                                    }
                                }}
                            >
                                <Text
                                    style={[
                                        styles.filterChipLabel,
                                        active && styles.filterChipLabelActive,
                                    ]}
                                >
                                    {racecraftFilterLabel[filter]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {activeRacecraftFilter === 'overtakes' ? (
                    isTeamInsightsMode ? (
                        topTeamOvertakeEntries.length ? (
                            topTeamOvertakeEntries.map((entry, index) => (
                                <View key={`racecraft-overtake-team-${entry.teamName}`} style={styles.listRow}>
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listDriverBlock}>
                                        <Text style={styles.listDriverName}>{entry.teamName}</Text>
                                        <Text style={styles.listMeta}>
                                            Made {entry.made} • Suffered {entry.suffered}
                                        </Text>
                                    </View>
                                    <Text style={styles.listValue}>
                                        {entry.net > 0 ? '+' : ''}
                                        {entry.net}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noData}>No team overtake data.</Text>
                        )
                    ) : topDriverOvertakeEntries.length ? (
                        topDriverOvertakeEntries.map((entry, index) => (
                            <View key={`racecraft-overtake-driver-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • Made {entry.made} • Suffered {entry.suffered}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {entry.net > 0 ? '+' : ''}
                                    {entry.net}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No driver overtake data.</Text>
                    )
                ) : activeRacecraftFilter === 'gains' ? (
                    isTeamInsightsMode ? (
                        topTeamPositionGainEntries.length ? (
                            topTeamPositionGainEntries.map((entry, index) => (
                                <View key={`racecraft-gain-team-${entry.teamName}`} style={styles.listRow}>
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listDriverBlock}>
                                        <Text style={styles.listDriverName}>{entry.teamName}</Text>
                                    </View>
                                    <Text style={styles.listValue}>
                                        {entry.netGain > 0 ? '+' : ''}
                                        {entry.netGain}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noData}>No team position gain data.</Text>
                        )
                    ) : topDriverPositionGainEntries.length ? (
                        topDriverPositionGainEntries.map((entry, index) => (
                            <View key={`racecraft-gain-driver-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • P{entry.start} → P{entry.finish}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {entry.gain > 0 ? '+' : ''}
                                    {entry.gain}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No driver position gain data.</Text>
                    )
                ) : isTeamInsightsMode ? (
                    topTeamPositionDropEntries.length ? (
                        topTeamPositionDropEntries.map((entry, index) => (
                            <View key={`racecraft-drop-team-${entry.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{entry.teamName}</Text>
                                </View>
                                <Text style={styles.listValue}>{entry.netGain}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team drops recorded.</Text>
                    )
                ) : topDriverPositionDropEntries.length ? (
                    topDriverPositionDropEntries.map((entry, index) => (
                        <View key={`racecraft-drop-driver-${entry.driverNumber}`} style={styles.listRow}>
                            <View style={styles.rankPill}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{entry.driverName}</Text>
                                <Text style={styles.listMeta}>
                                    {entry.teamName} • P{entry.start} → P{entry.finish}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>{entry.gain}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>No driver drops recorded.</Text>
                )}
                <TouchableOpacity
                    style={styles.storyButton}
                    onPress={() => handleOpenInsightDetails('racecraft')}
                >
                    <Text style={styles.storyButtonText}>View Full Racecraft Story</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Best Tyre Management</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? `Top 3 teams for ${activeTyreCompoundName.toLowerCase()} tyre fade`
                            : `Top 3 drivers for ${activeTyreCompoundName.toLowerCase()} tyre fade`}
                    </Text>
                </View>
                <Text style={styles.sectionStoryText}>
                    Lower degradation delta is better. Negative values mean pace improved over the
                    stint, while positive values indicate fade.
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                >
                    {compoundFilterOptions.map(compound => {
                        const active = compound === activeTyreCompoundFilter;
                        return (
                            <TouchableOpacity
                                key={`tyre-filter-${compound}`}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => {
                                    if (isTeamInsightsMode) {
                                        setSelectedTeamTyreCompound(compound);
                                    } else {
                                        setSelectedDriverTyreCompound(compound);
                                    }
                                }}
                            >
                                <Text
                                    style={[
                                        styles.filterChipLabel,
                                        active && styles.filterChipLabelActive,
                                    ]}
                                >
                                    {compound === OVERALL_FILTER
                                        ? 'Overall'
                                        : getCompoundName(compound)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {isTeamInsightsMode ? (
                    topTeamDegradationEntries.length ? (
                        topTeamDegradationEntries.map((entry, index) => (
                            <View key={`team-degradation-${entry.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(entry.teamColor) },
                                    ]}
                                />
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{entry.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.stintCount} {entry.stintCount === 1 ? 'stint' : 'stints'} •{' '}
                                        {entry.lapCount} laps • slope{' '}
                                        {formatSignedSeconds(entry.averageSlope)}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {formatSignedSeconds(entry.averageDeltaFirstToLast)}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team degradation data for this filter.</Text>
                    )
                ) : topDriverDegradationEntries.length ? (
                    topDriverDegradationEntries.map((entry, index) => (
                        <View
                            key={`degradation-driver-${entry.driverNumber}`}
                            style={styles.listRow}
                        >
                            <View style={styles.rankPill}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={[styles.teamDot, { backgroundColor: getTeamColorHex(entry.teamColor) }]} />
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{entry.driverName}</Text>
                                <Text style={styles.listMeta}>
                                    {entry.teamName} • {entry.stintCount}{' '}
                                    {entry.stintCount === 1 ? 'stint' : 'stints'} • {entry.lapCount}{' '}
                                    laps • slope{' '}
                                    {formatSignedSeconds(entry.averageSlope)}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>
                                {formatSignedSeconds(entry.averageDeltaFirstToLast)}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>No driver degradation data for this filter.</Text>
                )}
                {isTeamInsightsMode && bestTeamDegradationEntry ? (
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>
                            Best tyre management ({activeTyreCompoundName}):
                        </Text>
                        <Text style={styles.highlightValue}>
                            {bestTeamDegradationEntry.teamName} (
                            {formatSignedSeconds(bestTeamDegradationEntry.averageDeltaFirstToLast)})
                        </Text>
                    </View>
                ) : null}
                {!isTeamInsightsMode && bestDriverDegradationEntry ? (
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>
                            Best tyre management ({activeTyreCompoundName}):
                        </Text>
                        <Text style={styles.highlightValue}>
                            {bestDriverDegradationEntry.driverName} (
                            {formatSignedSeconds(bestDriverDegradationEntry.averageDeltaFirstToLast)})
                        </Text>
                    </View>
                ) : null}
                <TouchableOpacity
                    style={styles.storyButton}
                    onPress={() => handleOpenInsightDetails('degradation')}
                >
                    <Text style={styles.storyButtonText}>View All Tyre Degradation</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Pit Strategy Analyzer</Text>
                    <Text style={styles.listSubtitle}>Team stop efficiency and post-stop pace impact</Text>
                </View>
                {pitTeamInsights.length ? (
                    pitTeamInsights.slice(0, 3).map(team => (
                        <View key={`pit-team-${team.teamName}`} style={styles.listRow}>
                            <View style={[styles.teamDot, { backgroundColor: getTeamColorHex(team.teamColor) }]} />
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{team.teamName}</Text>
                                <Text style={styles.listMeta}>
                                    {team.stopCount} stops • avg {team.averageStop ? `${team.averageStop.toFixed(2)}s` : '—'}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>
                                {team.medianStop ? `${team.medianStop.toFixed(2)}s` : '—'}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>No pit-stop data available for this session.</Text>
                )}
                <View style={styles.highlightRow}>
                    <Text style={styles.highlightLabel}>Fastest stop:</Text>
                    <Text style={styles.highlightValue}>
                        {raceInsights?.pitStrategy.fastestStop
                            ? `${raceInsights.pitStrategy.fastestStop.driverName} (${raceInsights.pitStrategy.fastestStop.duration.toFixed(2)}s)`
                            : '—'}
                    </Text>
                </View>
                <View style={styles.highlightRow}>
                    <Text style={styles.highlightLabel}>Stops under SC:</Text>
                    <Text style={styles.highlightValue}>
                        {raceInsights?.pitStrategy.safetyCarPitStops ?? 0}
                    </Text>
                </View>
                {bestPitImpact ? (
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>Best post-stop delta:</Text>
                        <Text style={styles.highlightValue}>
                            {bestPitImpact.driverName} ({formatSignedSeconds(bestPitImpact.averageDelta)})
                        </Text>
                    </View>
                ) : null}
                {worstPitImpact ? (
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>Worst post-stop delta:</Text>
                        <Text style={styles.highlightValue}>
                            {worstPitImpact.driverName} ({formatSignedSeconds(worstPitImpact.averageDelta)})
                        </Text>
                    </View>
                ) : null}
                <TouchableOpacity
                    style={styles.storyButton}
                    onPress={() => handleOpenInsightDetails('pit')}
                >
                    <Text style={styles.storyButtonText}>View All Pit Strategy Data</Text>
                </TouchableOpacity>
            </View>

            {isTeamInsightsMode ? (
                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>Average Pace by Compound</Text>
                        <Text style={styles.listSubtitle}>
                            Top 3 teams for {activePaceCompoundName.toLowerCase()} pace
                        </Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundFilterOptions.map(option => {
                            const isActive = option === selectedTeamPaceCompound;
                            return (
                                <TouchableOpacity
                                    key={`team-pace-filter-${option}`}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => setSelectedTeamPaceCompound(option)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            isActive && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {option === OVERALL_FILTER
                                            ? 'Overall'
                                            : getCompoundName(option)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {topTeamPaceEntries.length ? (
                        topTeamPaceEntries.map((team, index) => (
                            <View key={`${team.teamName}-${activePaceCompoundFilter}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(team.color) },
                                    ]}
                                />
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{team.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        {activePaceCompoundName} • {team.lapCount} laps
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(team.avgTime)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team pace data for this filter.</Text>
                    )}
                    <TouchableOpacity
                        style={styles.storyButton}
                        onPress={() => handleOpenInsightDetails('compoundPace')}
                    >
                        <Text style={styles.storyButtonText}>View Full Compound Pace Data</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {!isTeamInsightsMode ? (
                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>Average Pace by Compound</Text>
                        <Text style={styles.listSubtitle}>
                            Top 3 drivers for {activePaceCompoundName.toLowerCase()} pace
                        </Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundFilterOptions.map(option => {
                            const isActive = option === selectedDriverPaceCompound;
                            return (
                                <TouchableOpacity
                                    key={`driver-pace-filter-${option}`}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => setSelectedDriverPaceCompound(option)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            isActive && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {option === OVERALL_FILTER
                                            ? 'Overall'
                                            : getCompoundName(option)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {topDriverPaceEntries.length ? (
                        topDriverPaceEntries.map((stat, index) => (
                            <View key={`${stat.driverNumber}-${activePaceCompoundFilter}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{stat.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {stat.teamName} • {activePaceCompoundName} • {stat.lapCount}{' '}
                                        {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(stat.avgTime)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No driver pace data for this filter.</Text>
                    )}
                    <TouchableOpacity
                        style={styles.storyButton}
                        onPress={() => handleOpenInsightDetails('compoundPace')}
                    >
                        <Text style={styles.storyButtonText}>View Full Compound Pace Data</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Pace Consistency</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? `Top 3 teams for ${activeConsistencyLabel.toLowerCase()} consistency`
                            : `Top 3 drivers for ${activeConsistencyLabel.toLowerCase()} consistency`}
                    </Text>
                </View>
                <Text style={styles.sectionStoryText}>
                    Lower SD is better (more stable lap times). CV = SD / average lap x 100, so
                    lower CV is also better.
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                >
                    {[OVERALL_FILTER, ...FUEL_LOAD_ORDER].map(filter => {
                        const active = filter === activeConsistencyFilter;
                        return (
                            <TouchableOpacity
                                key={`consistency-filter-${filter}`}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => {
                                    const nextFilter = filter as ConsistencyFilter;
                                    if (isTeamInsightsMode) {
                                        setSelectedTeamConsistencyFilter(nextFilter);
                                    } else {
                                        setSelectedDriverConsistencyFilter(nextFilter);
                                    }
                                }}
                            >
                                <Text
                                    style={[
                                        styles.filterChipLabel,
                                        active && styles.filterChipLabelActive,
                                    ]}
                                >
                                    {filter === OVERALL_FILTER
                                        ? 'Overall'
                                        : FUEL_LOAD_LABEL[filter as FuelLoad]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {isTeamInsightsMode ? (
                    topTeamConsistencyEntries.length ? (
                        topTeamConsistencyEntries.map((entry, index) => (
                            <View key={`team-consistency-${entry.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{entry.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.driverCount}{' '}
                                        {entry.driverCount === 1 ? 'driver' : 'drivers'} •{' '}
                                        {entry.lapCount} laps • CV{' '}
                                        {entry.coefficientOfVariation.toFixed(2)}%
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {entry.standardDeviation.toFixed(3)}s
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>Not enough clean laps for this filter.</Text>
                    )
                ) : topDriverConsistencyEntries.length ? (
                    topDriverConsistencyEntries.map((entry, index) => (
                        <View key={`consistency-${entry.driverNumber}`} style={styles.listRow}>
                            <View style={styles.rankPill}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{entry.driverName}</Text>
                                <Text style={styles.listMeta}>
                                    {entry.teamName} • {entry.lapCount} laps • CV{' '}
                                    {entry.coefficientOfVariation.toFixed(2)}%
                                </Text>
                            </View>
                            <Text style={styles.listValue}>{entry.standardDeviation.toFixed(3)}s</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Not enough clean laps for this filter.</Text>
                )}
                <TouchableOpacity
                    style={styles.storyButton}
                    onPress={() => handleOpenInsightDetails('consistency')}
                >
                    <Text style={styles.storyButtonText}>View All Pace Consistency</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default RaceScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: semanticColors.backgroundMuted,
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.sm,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.lg,
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
    heroCard: {
        backgroundColor: semanticColors.surfaceInverse,
        margin: spacing.md,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xxs,
    },
    actionRowSingle: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.xxs,
    },
    actionButton: {
        flex: 1,
        borderRadius: radius.xl,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: semanticColors.textPrimary,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    actionButtonSecondary: {
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.borderStrong,
        shadowOpacity: 0.05,
    },
    actionButtonTertiary: {
        backgroundColor: '#23233A',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    actionButtonSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    actionButtonTextDark: {
        color: semanticColors.textPrimary,
    },
    actionButtonSubtitleDark: {
        color: '#6E738B',
    },
    heroContent: {
        marginBottom: spacing.md,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.base,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginTop: spacing.xxs,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.75)',
        marginTop: spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: overlays.white15,
    },
    chipText: {
        color: semanticColors.surface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        letterSpacing: 0.4,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white08,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginTop: spacing.xxs,
    },
    insightsCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    cardHeader: {
        marginBottom: spacing.md,
    },
    cardOverline: {
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        textTransform: 'uppercase',
    },
    cardTitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    cardSubtitle: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    metricItem: {
        flex: 1,
        backgroundColor: semanticColors.surfaceMuted,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    metricValue: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    metricLabel: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    fastestPitCard: {
        marginTop: 18,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: '#F1F5FF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fastestPitLabel: {
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        color: '#5A6AA3',
        textTransform: 'uppercase',
        fontWeight: typography.weight.bold,
    },
    fastestPitValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: '#1B2C68',
    },
    fastestPitMetaBlock: {
        alignItems: 'flex-end',
    },
    fastestPitMeta: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1B2C68',
    },
    fastestPitMetaSecondary: {
        fontSize: typography.size.sm,
        color: '#5A6AA3',
        marginTop: 2,
    },
    fastestLapCard: {
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: '#F5EEFF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fastestLapLabel: {
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        color: '#71539E',
        textTransform: 'uppercase',
        fontWeight: typography.weight.bold,
    },
    fastestLapValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: '#3B2460',
    },
    fastestLapMetaBlock: {
        alignItems: 'flex-end',
        maxWidth: '60%',
    },
    fastestLapDriverRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fastestLapTeamDot: {
        marginRight: spacing.xs,
    },
    fastestLapMeta: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#3B2460',
    },
    fastestLapMetaSecondary: {
        fontSize: typography.size.sm,
        color: '#71539E',
        marginTop: 2,
        textAlign: 'right',
    },
    safetyCarCard: {
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,166,0,0.5)',
        backgroundColor: 'rgba(255,166,0,0.15)',
    },
    safetyCarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    safetyCarTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    safetyCarBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    safetyCarBadgeActive: {
        borderColor: '#E0A200',
        backgroundColor: '#FFD977',
    },
    safetyCarBadgeInactive: {
        borderColor: '#D8DBE8',
        backgroundColor: '#F0F1F6',
    },
    safetyCarBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    safetyCarBadgeTextActive: {
        color: '#7A4A00',
    },
    safetyCarBadgeTextInactive: {
        color: '#7C7F93',
    },
    safetyCarMeta: {
        fontSize: typography.size.sm,
        color: '#6C738F',
        marginBottom: spacing.xs,
    },
    safetyCarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E7E9F4',
    },
    safetyCarRowLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#2B2F3F',
    },
    safetyCarRowRange: {
        fontSize: typography.size.sm,
        color: '#7A7F97',
        marginTop: 2,
    },
    safetyCarRowCount: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#2B2F3F',
    },
    noSafetyCarText: {
        fontSize: typography.size.sm,
        color: '#7A7F97',
        fontStyle: 'italic',
    },
    climberCard: {
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: semanticColors.dangerSoft,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#F5B7B1',
    },
    climberBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        backgroundColor: '#FFE2DF',
        marginBottom: spacing.xs,
    },
    climberBadgeText: {
        fontSize: typography.size.xs,
        color: '#D04B3E',
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    climberDriver: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: '#A32A1F',
    },
    climberMeta: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        color: '#A65E59',
    },
    climberTeam: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: '#C27E77',
    },
    listCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    insightModeCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    insightModeLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    insightModeOptions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listHeader: {
        marginBottom: spacing.sm,
    },
    fuelConsistencyBlock: {
        marginTop: spacing.md,
    },
    fuelConsistencyHeader: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: typography.weight.bold,
    },
    fuelConsistencySection: {
        marginTop: spacing.sm,
    },
    fuelConsistencyTitle: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1F2435',
    },
    fuelConsistencyRange: {
        marginTop: 2,
        marginBottom: 2,
        fontSize: typography.size.sm,
        color: '#7A819D',
    },
    listTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSubtitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    sectionStoryText: {
        fontSize: typography.size.sm,
        color: semanticColors.textSecondary,
        marginBottom: spacing.xs,
    },
    filterScroll: {
        marginBottom: spacing.xs,
    },
    filterContent: {
        paddingVertical: spacing.xxs,
    },
    filterChip: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#D5DAE7',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginRight: spacing.xs,
        backgroundColor: semanticColors.surface,
    },
    filterChipActive: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    filterChipLabel: {
        fontSize: typography.size.sm,
        color: '#6E738B',
        fontWeight: typography.weight.semibold,
    },
    filterChipLabelActive: {
        color: semanticColors.surface,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.borderMuted,
    },
    noData: {
        textAlign: 'center',
        color: '#8A8FA6',
        fontSize: typography.size.sm,
        paddingVertical: spacing.sm,
    },
    highlightRow: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: semanticColors.borderMuted,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    highlightLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        fontWeight: typography.weight.semibold,
    },
    highlightValue: {
        fontSize: typography.size.sm,
        color: '#1C2238',
        fontWeight: typography.weight.bold,
        flexShrink: 1,
        textAlign: 'right',
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: radius.lg,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    rankText: {
        fontWeight: typography.weight.bold,
        color: '#5C6BFF',
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listMeta: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        marginTop: 2,
    },
    listValue: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginLeft: spacing.sm,
    },
    expandButton: {
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D5DAE7',
        alignItems: 'center',
        backgroundColor: '#F8FAFF',
    },
    expandButtonText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: '#2C2C34',
    },
    storyButton: {
        marginTop: spacing.sm,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        backgroundColor: semanticColors.textPrimary,
    },
    storyButtonText: {
        color: semanticColors.surface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    teamDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: spacing.sm,
    },
    refreshHint: {
        paddingVertical: spacing.xl,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
