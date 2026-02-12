import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

const EMPTY_SAFETY_CAR_LAPS: number[] = [];
type InsightViewMode = 'drivers' | 'teams';
type FuelLoad = 'heavy' | 'medium' | 'low';
const INSIGHT_LIST_LIMIT = 5;
const FUEL_LOAD_ORDER: FuelLoad[] = ['heavy', 'medium', 'low'];
const FUEL_LOAD_LABEL: Record<FuelLoad, string> = {
    heavy: 'Heavy Fuel',
    medium: 'Medium Fuel',
    low: 'Low Fuel',
};

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
    const [selectedDriverCompound, setSelectedDriverCompound] = useState<string | null>(null);
    const [selectedTeamCompound, setSelectedTeamCompound] = useState<string | null>(null);
    const [showAllTeams, setShowAllTeams] = useState(false);
    const [insightViewMode, setInsightViewMode] = useState<InsightViewMode>('drivers');
    const [showAllOvertakeTeams, setShowAllOvertakeTeams] = useState(false);
    const [showAllPositionTeams, setShowAllPositionTeams] = useState(false);
    const [showAllConsistencyTeams, setShowAllConsistencyTeams] = useState(false);
    const [showAllDegradationTeams, setShowAllDegradationTeams] = useState(false);

    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const raceLapCount = useMemo(() => {
        if (rows[0]?.laps) return rows[0].laps;
        return driverEntries.reduce((max, entry) => Math.max(max, entry.laps.length), 0);
    }, [rows, driverEntries]);

    const fuelLoadBounds = useMemo(() => {
        const maxLapFromEntries = driverEntries.reduce((max, entry) => {
            const entryMax = entry.laps.reduce(
                (lapMax, lap) => Math.max(lapMax, lap.lap_number),
                0
            );
            return Math.max(max, entryMax);
        }, 0);

        const totalLaps =
            typeof raceLapCount === 'number' && raceLapCount > 0
                ? raceLapCount
                : maxLapFromEntries;
        const normalizedTotal = Math.max(1, totalLaps);
        const heavyEndLap = Math.ceil(normalizedTotal / 3);
        const mediumEndLap = Math.ceil((2 * normalizedTotal) / 3);

        return {
            totalLaps: normalizedTotal,
            heavyEndLap,
            mediumEndLap,
        };
    }, [driverEntries, raceLapCount]);

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

    const driverOptionsPayload = useMemo(() => {
        const map = new Map<
            number,
            { driverNumber: number; name: string; team: string; teamColor?: string | null }
        >();
        driverEntries.forEach(entry => {
            map.set(entry.driverNumber, {
                driverNumber: entry.driverNumber,
                name: entry.driver.name,
                team: entry.driver.team,
                teamColor: entry.driver.teamColor,
            });
        });
        if (!map.size) return [];
        if (!rows.length) {
            return Array.from(map.values());
        }
        const ordered: {
            driverNumber: number;
            name: string;
            team: string;
            teamColor?: string | null;
        }[] = [];
        rows.forEach(row => {
            const option = map.get(row.driverNumber);
            if (option) {
                ordered.push(option);
                map.delete(row.driverNumber);
            }
        });
        map.forEach(option => ordered.push(option));
        return ordered;
    }, [driverEntries, rows]);

    const compoundOptions = useMemo(() => {
        const set = new Set<string>();
        driverEntries.forEach(entry => {
            entry.stints.forEach(stint => {
                if (stint.compound) {
                    set.add(stint.compound.toUpperCase());
                }
            });
        });
        return Array.from(set);
    }, [driverEntries]);

    useEffect(() => {
        if (compoundOptions.length === 0) {
            setSelectedDriverCompound(null);
            setSelectedTeamCompound(null);
            setShowAllTeams(false);
            return;
        }
        setSelectedDriverCompound(prev =>
            prev && compoundOptions.includes(prev) ? prev : compoundOptions[0]
        );
        setSelectedTeamCompound(prev =>
            prev && compoundOptions.includes(prev) ? prev : compoundOptions[0]
        );
    }, [compoundOptions]);

    useEffect(() => {
        setShowAllTeams(false);
    }, [selectedTeamCompound]);

    useEffect(() => {
        setShowAllOvertakeTeams(false);
        setShowAllPositionTeams(false);
        setShowAllConsistencyTeams(false);
        setShowAllDegradationTeams(false);
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
            map.set(compound, list.slice(0, 5));
        });
        return map;
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

    type TeamCompoundStat = {
        teamName: string;
        avgTime: number;
        color?: string | null;
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
                });
            });
            teams.sort((a, b) => a.avgTime - b.avgTime);
            result.set(compound, teams);
        });

        return result;
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

    const driverLeaders =
        selectedDriverCompound && driverPaceByCompound.has(selectedDriverCompound)
            ? driverPaceByCompound.get(selectedDriverCompound) ?? []
            : [];
    const teamLeaders =
        selectedTeamCompound && teamPaceByCompound.has(selectedTeamCompound)
            ? teamPaceByCompound.get(selectedTeamCompound) ?? []
            : [];

    const displayedTeamLeaders = useMemo(() => {
        if (!teamLeaders.length) return [];
        return showAllTeams ? teamLeaders : teamLeaders.slice(0, 5);
    }, [teamLeaders, showAllTeams]);

    const overtakeDriverLeaders = raceInsights?.overtakeLeaderboard.drivers ?? [];
    const overtakeTeamLeaders = raceInsights?.overtakeLeaderboard.teams ?? [];
    const degradationLeaders = raceInsights?.tyreDegradation.stints ?? [];
    const pitTeamInsights = raceInsights?.pitStrategy.teams ?? [];
    const pitImpactInsights = raceInsights?.pitStrategy.pitImpact ?? [];
    const consistencyInsights = raceInsights?.paceConsistency.drivers ?? [];
    const positionChangeInsights = raceInsights?.positionChanges.drivers ?? [];
    const teamPositionChanges = raceInsights?.positionChanges.teams ?? [];
    const isTeamInsightsMode = insightViewMode === 'teams';

    const displayedOvertakeDriverLeaders = overtakeDriverLeaders.slice(0, INSIGHT_LIST_LIMIT);
    const displayedPositionChangeInsights = positionChangeInsights.slice(0, INSIGHT_LIST_LIMIT);
    const displayedConsistencyInsights = consistencyInsights.slice(0, INSIGHT_LIST_LIMIT);
    const displayedDegradationLeaders = degradationLeaders.slice(0, INSIGHT_LIST_LIMIT);

    const displayedOvertakeTeamLeaders = useMemo(() => {
        if (showAllOvertakeTeams) return overtakeTeamLeaders;
        return overtakeTeamLeaders.slice(0, INSIGHT_LIST_LIMIT);
    }, [overtakeTeamLeaders, showAllOvertakeTeams]);

    const displayedTeamPositionChanges = useMemo(() => {
        if (showAllPositionTeams) return teamPositionChanges;
        return teamPositionChanges.slice(0, INSIGHT_LIST_LIMIT);
    }, [teamPositionChanges, showAllPositionTeams]);

    type TeamConsistencyInsight = {
        teamName: string;
        driverCount: number;
        lapCount: number;
        standardDeviation: number;
        coefficientOfVariation: number;
    };

    const getFuelLoadForLap = useCallback(
        (lapNumber: number): FuelLoad => {
            if (lapNumber <= fuelLoadBounds.heavyEndLap) return 'heavy';
            if (lapNumber <= fuelLoadBounds.mediumEndLap) return 'medium';
            return 'low';
        },
        [fuelLoadBounds.heavyEndLap, fuelLoadBounds.mediumEndLap]
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

    type TeamTyreDegradationInsight = {
        teamName: string;
        teamColor?: string | null;
        stintCount: number;
        lapCount: number;
        averageSlope: number | null;
        averageDeltaFirstToLast: number | null;
    };

    const teamDegradationInsights = useMemo<TeamTyreDegradationInsight[]>(() => {
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

        degradationLeaders.forEach(entry => {
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
            if (a.averageDeltaFirstToLast == null && b.averageDeltaFirstToLast == null) return 0;
            if (a.averageDeltaFirstToLast == null) return 1;
            if (b.averageDeltaFirstToLast == null) return -1;

            const deltaDiff = b.averageDeltaFirstToLast - a.averageDeltaFirstToLast;
            if (deltaDiff !== 0) return deltaDiff;

            if (a.averageSlope == null && b.averageSlope == null) return 0;
            if (a.averageSlope == null) return 1;
            if (b.averageSlope == null) return -1;
            return b.averageSlope - a.averageSlope;
        });

        return teams;
    }, [degradationLeaders]);

    const displayedTeamConsistencyInsights = useMemo(() => {
        if (showAllConsistencyTeams) return teamConsistencyInsights;
        return teamConsistencyInsights.slice(0, INSIGHT_LIST_LIMIT);
    }, [showAllConsistencyTeams, teamConsistencyInsights]);

    const displayedTeamConsistencyByFuelLoad = useMemo<
        Record<FuelLoad, TeamFuelConsistencyInsight[]>
    >(() => {
        if (showAllConsistencyTeams) {
            return teamConsistencyByFuelLoad;
        }
        return {
            heavy: teamConsistencyByFuelLoad.heavy.slice(0, INSIGHT_LIST_LIMIT),
            medium: teamConsistencyByFuelLoad.medium.slice(0, INSIGHT_LIST_LIMIT),
            low: teamConsistencyByFuelLoad.low.slice(0, INSIGHT_LIST_LIMIT),
        };
    }, [showAllConsistencyTeams, teamConsistencyByFuelLoad]);

    const hasMoreTeamConsistencyRows =
        teamConsistencyInsights.length > INSIGHT_LIST_LIMIT ||
        FUEL_LOAD_ORDER.some(
            fuelLoad => teamConsistencyByFuelLoad[fuelLoad].length > INSIGHT_LIST_LIMIT
        );

    const displayedTeamDegradationInsights = useMemo(() => {
        if (showAllDegradationTeams) return teamDegradationInsights;
        return teamDegradationInsights.slice(0, INSIGHT_LIST_LIMIT);
    }, [showAllDegradationTeams, teamDegradationInsights]);

    type FastestPitStop = {
        duration: number;
        team: string;
        driver: string;
        lap: number | null;
    };

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
        if (!data) return;
        navigation.navigate('RaceOvertakes', {
            sessionKey,
            sessionName,
            meetingName,
            overtakes: data.overtakes ?? [],
            driverEntries: data.drivers ?? [],
        });
    }, [data, meetingName, navigation, sessionKey, sessionName]);

    const openDriverOverview = useCallback(
        (driverNumber: number | null | undefined) => {
            if (typeof driverNumber !== 'number') return;
            const driverDataEntry =
                driverEntries.find(entry => entry.driverNumber === driverNumber) ?? null;
            navigation.navigate('DriverOverview', {
                driverNumber,
                sessionKey,
                safetyCarLaps,
                driverData: driverDataEntry,
                driverOptions: driverOptionsPayload,
            });
        },
        [driverEntries, driverOptionsPayload, navigation, safetyCarLaps, sessionKey]
    );

    const handleOpenDriverData = useCallback(() => {
        openDriverOverview(defaultDriverNumber);
    }, [defaultDriverNumber, openDriverOverview]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
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

    const selectedTeamCompoundName = selectedTeamCompound
        ? getCompoundName(selectedTeamCompound)
        : null;
    const selectedDriverCompoundName = selectedDriverCompound
        ? getCompoundName(selectedDriverCompound)
        : null;

    const biggestDropper = positionChangeInsights.length
        ? [...positionChangeInsights].sort((a, b) => a.gain - b.gain)[0]
        : null;
    const bestTeamPositionGain = teamPositionChanges.length ? teamPositionChanges[0] : null;
    const bestPitImpact = pitImpactInsights.length ? pitImpactInsights[0] : null;
    const worstPitImpact = pitImpactInsights.length
        ? pitImpactInsights[pitImpactInsights.length - 1]
        : null;

    const heroStats = [
        { label: 'Drivers', value: driverEntries.length || '–' },
        { label: 'SC Laps', value: safetyCarLapCount || '0' },
        { label: 'Laps', value: totalRaceLapsDisplay },
    ];

    const mediumStartLap = fuelLoadBounds.heavyEndLap + 1;
    const lowStartLap = fuelLoadBounds.mediumEndLap + 1;
    const fuelLoadRangeLabel: Record<FuelLoad, string> = {
        heavy: `Laps 1-${fuelLoadBounds.heavyEndLap}`,
        medium:
            mediumStartLap <= fuelLoadBounds.mediumEndLap
                ? `Laps ${mediumStartLap}-${fuelLoadBounds.mediumEndLap}`
                : 'No mapped laps',
        low:
            lowStartLap <= fuelLoadBounds.totalLaps
                ? `Laps ${lowStartLap}-${fuelLoadBounds.totalLaps}`
                : 'No mapped laps',
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
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
                    <Text style={styles.listTitle}>Overtake Leaderboard</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? 'Made / suffered / net by team'
                            : 'Made / suffered / net by driver'}
                    </Text>
                </View>
                {isTeamInsightsMode ? (
                    overtakeTeamLeaders.length ? (
                        displayedOvertakeTeamLeaders.map((team, index) => (
                            <View key={`overtake-team-${team.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{team.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        Made {team.made} • Suffered {team.suffered}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {team.net > 0 ? '+' : ''}
                                    {team.net}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team overtake data for this session.</Text>
                    )
                ) : overtakeDriverLeaders.length ? (
                    displayedOvertakeDriverLeaders.map((entry, index) => (
                        <View key={`overtake-driver-${entry.driverNumber}`} style={styles.listRow}>
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
                    <Text style={styles.noData}>No overtakes recorded in this session.</Text>
                )}
                {isTeamInsightsMode && overtakeTeamLeaders.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowAllOvertakeTeams(prev => !prev)}
                    >
                        <Text style={styles.expandButtonText}>
                            {showAllOvertakeTeams ? 'Show Top 5 Teams' : 'Show All Teams'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {!isTeamInsightsMode && overtakeDriverLeaders.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() =>
                            openDriverOverview(displayedOvertakeDriverLeaders[0]?.driverNumber)
                        }
                    >
                        <Text style={styles.expandButtonText}>Open Driver Details</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Position Gain Story</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? 'Combined grid-to-finish movement by team'
                            : 'Grid vs finish movement by driver'}
                    </Text>
                </View>
                {isTeamInsightsMode ? (
                    teamPositionChanges.length ? (
                        displayedTeamPositionChanges.map((team, index) => (
                            <View key={`team-gain-${team.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{team.teamName}</Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {team.netGain > 0 ? '+' : ''}
                                    {team.netGain}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team position gain data for this race.</Text>
                    )
                ) : positionChangeInsights.length ? (
                    displayedPositionChangeInsights.map((entry, index) => (
                        <View key={`position-change-${entry.driverNumber}`} style={styles.listRow}>
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
                    <Text style={styles.noData}>Starting grid data is unavailable for this race.</Text>
                )}
                {isTeamInsightsMode ? (
                    bestTeamPositionGain ? (
                        <View style={styles.highlightRow}>
                            <Text style={styles.highlightLabel}>Best team gain:</Text>
                            <Text style={styles.highlightValue}>
                                {bestTeamPositionGain.teamName} (
                                {bestTeamPositionGain.netGain > 0 ? '+' : ''}
                                {bestTeamPositionGain.netGain})
                            </Text>
                        </View>
                    ) : null
                ) : biggestDropper ? (
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>Biggest drop:</Text>
                        <Text style={styles.highlightValue}>
                            {biggestDropper.driverName} ({biggestDropper.gain > 0 ? '+' : ''}
                            {biggestDropper.gain})
                        </Text>
                    </View>
                ) : null}
                {isTeamInsightsMode && teamPositionChanges.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowAllPositionTeams(prev => !prev)}
                    >
                        <Text style={styles.expandButtonText}>
                            {showAllPositionTeams ? 'Show Top 5 Teams' : 'Show All Teams'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {!isTeamInsightsMode && positionChangeInsights.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() =>
                            openDriverOverview(displayedPositionChangeInsights[0]?.driverNumber)
                        }
                    >
                        <Text style={styles.expandButtonText}>Open Driver Details</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Race Pace Consistency</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? 'Standard deviation on combined clean laps per team + fuel-load splits'
                            : 'Standard deviation on clean race laps'}
                    </Text>
                </View>
                {isTeamInsightsMode ? (
                    <>
                        {teamConsistencyInsights.length ? (
                            displayedTeamConsistencyInsights.map((entry, index) => (
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
                            <Text style={styles.noData}>
                                Not enough clean laps to score team consistency.
                            </Text>
                        )}

                        <View style={styles.fuelConsistencyBlock}>
                            <Text style={styles.fuelConsistencyHeader}>
                                Team Consistency by Fuel Load
                            </Text>
                            {FUEL_LOAD_ORDER.map(fuelLoad => {
                                const fuelInsights = displayedTeamConsistencyByFuelLoad[fuelLoad];
                                return (
                                    <View key={`fuel-consistency-${fuelLoad}`} style={styles.fuelConsistencySection}>
                                        <Text style={styles.fuelConsistencyTitle}>
                                            {FUEL_LOAD_LABEL[fuelLoad]}
                                        </Text>
                                        <Text style={styles.fuelConsistencyRange}>
                                            {fuelLoadRangeLabel[fuelLoad]}
                                        </Text>
                                        {fuelInsights.length ? (
                                            fuelInsights.map((entry, index) => (
                                                <View
                                                    key={`fuel-consistency-${fuelLoad}-${entry.teamName}`}
                                                    style={styles.listRow}
                                                >
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
                                            <Text style={styles.noData}>
                                                Not enough {FUEL_LOAD_LABEL[fuelLoad].toLowerCase()} laps.
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : consistencyInsights.length ? (
                    displayedConsistencyInsights.map((entry, index) => (
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
                    <Text style={styles.noData}>Not enough clean laps to score consistency.</Text>
                )}
                {isTeamInsightsMode && hasMoreTeamConsistencyRows ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowAllConsistencyTeams(prev => !prev)}
                    >
                        <Text style={styles.expandButtonText}>
                            {showAllConsistencyTeams ? 'Show Top 5 Teams' : 'Show All Teams'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {!isTeamInsightsMode && consistencyInsights.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => openDriverOverview(displayedConsistencyInsights[0]?.driverNumber)}
                    >
                        <Text style={styles.expandButtonText}>Open Driver Details</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Tyre Degradation Score</Text>
                    <Text style={styles.listSubtitle}>
                        {isTeamInsightsMode
                            ? 'Weighted average stint fade by team'
                            : 'Delta from opening laps to end of each stint'}
                    </Text>
                </View>
                {isTeamInsightsMode ? (
                    teamDegradationInsights.length ? (
                        displayedTeamDegradationInsights.map(entry => (
                            <View key={`team-degradation-${entry.teamName}`} style={styles.listRow}>
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
                        <Text style={styles.noData}>
                            No team stints with enough laps for degradation analysis.
                        </Text>
                    )
                ) : degradationLeaders.length ? (
                    displayedDegradationLeaders.map(entry => (
                        <View key={`degradation-${entry.driverNumber}-${entry.stintNumber}`} style={styles.listRow}>
                            <View style={[styles.teamDot, { backgroundColor: getTeamColorHex(entry.teamColor) }]} />
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>
                                    {entry.driverName} • {getCompoundName(entry.compound)}
                                </Text>
                                <Text style={styles.listMeta}>
                                    Stint {entry.stintNumber} • {entry.lapCount} laps • slope{' '}
                                    {formatSignedSeconds(entry.slope)}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>
                                {formatSignedSeconds(entry.deltaFirstToLast)}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>No stints with enough laps for degradation analysis.</Text>
                )}
                {isTeamInsightsMode && teamDegradationInsights.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowAllDegradationTeams(prev => !prev)}
                    >
                        <Text style={styles.expandButtonText}>
                            {showAllDegradationTeams ? 'Show Top 5 Teams' : 'Show All Teams'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {!isTeamInsightsMode && degradationLeaders.length > INSIGHT_LIST_LIMIT ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => openDriverOverview(displayedDegradationLeaders[0]?.driverNumber)}
                    >
                        <Text style={styles.expandButtonText}>Open Driver Details</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Pit Strategy Analyzer</Text>
                    <Text style={styles.listSubtitle}>Team stop efficiency and post-stop pace impact</Text>
                </View>
                {pitTeamInsights.length ? (
                    pitTeamInsights.slice(0, 5).map(team => (
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
            </View>

            {isTeamInsightsMode ? (
                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>Team Avg Pace by Compound</Text>
                        <Text style={styles.listSubtitle}>Combined average of both drivers</Text>
                    </View>
                    {compoundOptions.length ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.filterScroll}
                            contentContainerStyle={styles.filterContent}
                        >
                            {compoundOptions.map(option => {
                                const isActive = option === selectedTeamCompound;
                                const label = getCompoundName(option);
                                return (
                                    <TouchableOpacity
                                        key={`team-compound-${option}`}
                                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        onPress={() => {
                                            if (option !== selectedTeamCompound) {
                                                setSelectedTeamCompound(option);
                                                setShowAllTeams(false);
                                            }
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipLabel,
                                                isActive && styles.filterChipLabelActive,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    ) : null}
                    {selectedTeamCompound && displayedTeamLeaders.length ? (
                        displayedTeamLeaders.map(team => (
                            <View key={team.teamName} style={styles.listRow}>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(team.color) },
                                    ]}
                                />
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{team.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        Average pace on {getCompoundName(selectedTeamCompound)}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(team.avgTime)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>
                            {selectedTeamCompoundName
                                ? `No representative team pace on ${selectedTeamCompoundName}`
                                : 'No team pace data'}
                        </Text>
                    )}
                    {selectedTeamCompound && teamLeaders.length > 5 ? (
                        <TouchableOpacity
                            style={styles.expandButton}
                            onPress={() => setShowAllTeams(prev => !prev)}
                        >
                            <Text style={styles.expandButtonText}>
                                {showAllTeams ? 'Show Less' : 'Show All Teams'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {!isTeamInsightsMode ? (
                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>Top Driver Pace by Compound</Text>
                        <Text style={styles.listSubtitle}>Excludes pit exit & safety car laps</Text>
                    </View>
                    {compoundOptions.length ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.filterScroll}
                            contentContainerStyle={styles.filterContent}
                        >
                            {compoundOptions.map(option => {
                                const isActive = option === selectedDriverCompound;
                                const label = getCompoundName(option);
                                return (
                                    <TouchableOpacity
                                        key={`driver-compound-${option}`}
                                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        onPress={() => setSelectedDriverCompound(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipLabel,
                                                isActive && styles.filterChipLabelActive,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    ) : null}
                    {selectedDriverCompound && driverLeaders.length ? (
                        driverLeaders.map((stat, index) => (
                            <View key={`${stat.driverNumber}-${selectedDriverCompound}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{stat.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {stat.teamName} • {selectedDriverCompoundName ?? 'Unknown'} • {stat.lapCount}{' '}
                                        {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(stat.avgTime)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>
                            {selectedDriverCompoundName
                                ? `No clean laps for ${selectedDriverCompoundName} yet`
                                : 'No compound data available'}
                        </Text>
                    )}
                    {selectedDriverCompound && driverLeaders.length ? (
                        <TouchableOpacity
                            style={styles.expandButton}
                            onPress={() => openDriverOverview(driverLeaders[0]?.driverNumber)}
                        >
                            <Text style={styles.expandButtonText}>Open Driver Details</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default RaceScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2F2F2',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#E10600',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    heroCard: {
        backgroundColor: '#1C1C27',
        margin: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
        marginBottom: 4,
    },
    actionRowSingle: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
    },
    actionButton: {
        flex: 1,
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#15151E',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    actionButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D9DFEA',
        shadowOpacity: 0.05,
    },
    actionButtonTertiary: {
        backgroundColor: '#23233A',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionButtonSubtitle: {
        marginTop: 6,
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    actionButtonTextDark: {
        color: '#15151E',
    },
    actionButtonSubtitleDark: {
        color: '#6E738B',
    },
    heroContent: {
        marginBottom: 16,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 4,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.75)',
        marginTop: 6,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        paddingVertical: 12,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 4,
    },
    insightsCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardOverline: {
        fontSize: 12,
        letterSpacing: 1,
        fontWeight: '700',
        color: '#7A7E92',
        textTransform: 'uppercase',
    },
    cardTitle: {
        marginTop: 4,
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    cardSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#7A7E92',
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    metricItem: {
        flex: 1,
        backgroundColor: '#F7F8FB',
        borderRadius: 16,
        padding: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E6F0',
    },
    metricValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#15151E',
    },
    metricLabel: {
        marginTop: 6,
        fontSize: 12,
        color: '#7A7E92',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    fastestPitCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#F1F5FF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fastestPitLabel: {
        fontSize: 12,
        letterSpacing: 0.6,
        color: '#5A6AA3',
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    fastestPitValue: {
        marginTop: 4,
        fontSize: 24,
        fontWeight: '700',
        color: '#1B2C68',
    },
    fastestPitMetaBlock: {
        alignItems: 'flex-end',
    },
    fastestPitMeta: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B2C68',
    },
    fastestPitMetaSecondary: {
        fontSize: 12,
        color: '#5A6AA3',
        marginTop: 2,
    },
    safetyCarCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,166,0,0.5)',
        backgroundColor: 'rgba(255,166,0,0.15)',
    },
    safetyCarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    safetyCarTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
    },
    safetyCarBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
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
        fontSize: 11,
        fontWeight: '700',
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
        fontSize: 13,
        color: '#6C738F',
        marginBottom: 8,
    },
    safetyCarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E7E9F4',
    },
    safetyCarRowLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2B2F3F',
    },
    safetyCarRowRange: {
        fontSize: 12,
        color: '#7A7F97',
        marginTop: 2,
    },
    safetyCarRowCount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2B2F3F',
    },
    noSafetyCarText: {
        fontSize: 13,
        color: '#7A7F97',
        fontStyle: 'italic',
    },
    climberCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FDF1F0',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#F5B7B1',
    },
    climberBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#FFE2DF',
        marginBottom: 8,
    },
    climberBadgeText: {
        fontSize: 11,
        color: '#D04B3E',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    climberDriver: {
        fontSize: 18,
        fontWeight: '700',
        color: '#A32A1F',
    },
    climberMeta: {
        marginTop: 4,
        fontSize: 13,
        color: '#A65E59',
    },
    climberTeam: {
        marginTop: 2,
        fontSize: 12,
        color: '#C27E77',
    },
    listCard: {
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    insightModeCard: {
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    insightModeLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7A7E92',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    insightModeOptions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listHeader: {
        marginBottom: 12,
    },
    fuelConsistencyBlock: {
        marginTop: 14,
    },
    fuelConsistencyHeader: {
        fontSize: 13,
        color: '#7A7E92',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '700',
    },
    fuelConsistencySection: {
        marginTop: 10,
    },
    fuelConsistencyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2435',
    },
    fuelConsistencyRange: {
        marginTop: 2,
        marginBottom: 2,
        fontSize: 12,
        color: '#7A819D',
    },
    listTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    listSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#7A7E92',
    },
    filterScroll: {
        marginBottom: 8,
    },
    filterContent: {
        paddingVertical: 4,
    },
    filterChip: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D5DAE7',
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginRight: 8,
        backgroundColor: '#FFF',
    },
    filterChipActive: {
        backgroundColor: '#15151E',
        borderColor: '#15151E',
    },
    filterChipLabel: {
        fontSize: 13,
        color: '#6E738B',
        fontWeight: '600',
    },
    filterChipLabelActive: {
        color: '#FFF',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ECEFF5',
    },
    noData: {
        textAlign: 'center',
        color: '#8A8FA6',
        fontSize: 13,
        paddingVertical: 12,
    },
    highlightRow: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#ECEFF5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    highlightLabel: {
        fontSize: 13,
        color: '#7A7E92',
        fontWeight: '600',
    },
    highlightValue: {
        fontSize: 13,
        color: '#1C2238',
        fontWeight: '700',
        flexShrink: 1,
        textAlign: 'right',
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontWeight: '700',
        color: '#5C6BFF',
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    listMeta: {
        fontSize: 12,
        color: '#7A7E92',
        marginTop: 2,
    },
    listValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
        marginLeft: 12,
    },
    expandButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D5DAE7',
        alignItems: 'center',
        backgroundColor: '#F8FAFF',
    },
    expandButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2C2C34',
    },
    teamDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 12,
    },
    refreshHint: {
        paddingVertical: 24,
        textAlign: 'center',
        color: '#AAA',
    },
});
