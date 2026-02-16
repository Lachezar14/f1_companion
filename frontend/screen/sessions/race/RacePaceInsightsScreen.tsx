import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getRaceSessionDetail } from '../../../../backend/service/openf1Service';
import type { RaceSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { formatLapTime } from '../../../../shared/time';
import { getCompoundName } from '../../../../utils/tyre';
import { getTeamColorHex } from '../../../../utils/driver';
import { calculateAvgLapTimePerCompound } from '../../../../utils/lap';

type InsightViewMode = 'drivers' | 'teams';
type FuelLoad = 'heavy' | 'medium' | 'low';
type InsightDetailType = 'degradation' | 'racecraft' | 'consistency' | 'compoundPace' | 'pit';
type ConsistencyFilter = 'overall' | FuelLoad;
type RacecraftFilter = 'overtakes' | 'gains' | 'drops';

const FUEL_LOAD_ORDER: FuelLoad[] = ['heavy', 'medium', 'low'];
const FUEL_LOAD_LABEL: Record<FuelLoad, string> = {
    heavy: 'High Fuel',
    medium: 'Medium Fuel',
    low: 'Low Fuel',
};
const OVERALL_FILTER = 'overall';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
    initialViewMode?: InsightViewMode;
    detailType: InsightDetailType;
    initialFilter?: string;
};

type TeamConsistencyInsight = {
    teamName: string;
    driverCount: number;
    lapCount: number;
    averageLap: number;
    standardDeviation: number;
    coefficientOfVariation: number;
};

type TeamDegradationInsight = {
    teamName: string;
    teamColor?: string | null;
    stintCount: number;
    lapCount: number;
    averageSlope: number | null;
    averageDeltaFirstToLast: number | null;
};

type DriverDegradationInsight = {
    driverNumber: number;
    driverName: string;
    teamName: string;
    teamColor?: string | null;
    stintCount: number;
    lapCount: number;
    averageSlope: number | null;
    averageDeltaFirstToLast: number | null;
};

type DriverFuelConsistencyInsight = {
    fuelLoad: FuelLoad;
    driverNumber: number;
    driverName: string;
    teamName: string;
    lapCount: number;
    averageLap: number;
    standardDeviation: number;
    coefficientOfVariation: number;
};

type TeamFuelConsistencyInsight = {
    fuelLoad: FuelLoad;
    teamName: string;
    driverCount: number;
    lapCount: number;
    averageLap: number;
    standardDeviation: number;
    coefficientOfVariation: number;
};

type DriverCompoundStat = {
    driverName: string;
    driverNumber: number;
    teamName: string;
    teamColor?: string | null;
    lapCount: number;
    avgTime: number;
};

type TeamCompoundStat = {
    teamName: string;
    avgTime: number;
    color?: string | null;
    lapCount: number;
};

const DETAIL_META: Record<InsightDetailType, { title: string; subtitle: string; bullets: string[] }> = {
    degradation: {
        title: 'Tyre Management',
        subtitle: 'Best-to-worst tyre fade ranking.',
        bullets: [
            'Lower delta is better (less degradation).',
            'Delta = avg(last up to 3 laps) - avg(first up to 3 laps).',
            'Negative delta means pace improved over the stint.',
        ],
    },
    racecraft: {
        title: 'Racecraft Story',
        subtitle: 'Overtakes and position movement in one view.',
        bullets: [
            'Overtake net = made - suffered.',
            'Position gain = start - finish.',
            'Positive values are better in both views.',
        ],
    },
    consistency: {
        title: 'Pace Consistency',
        subtitle: 'Overall and fuel-load stability.',
        bullets: [
            'SD (standard deviation): lower is better (more stable lap times).',
            'CV = SD / average lap x 100, so lower CV is also better.',
            'Includes high / medium / low fuel split rankings.',
        ],
    },
    compoundPace: {
        title: 'Average Pace by Compound',
        subtitle: 'Complete pace tables per tyre compound.',
        bullets: [
            'Uses clean lap averages on each compound.',
            'Driver view ranks individual drivers per compound.',
            'Team view combines both drivers with lap-weighted averaging.',
        ],
    },
    pit: {
        title: 'Pit Strategy',
        subtitle: 'Team-only pit performance view.',
        bullets: [
            'Teams are ranked by median stop time (lower is better).',
            'Average stop time gives overall pace context.',
            'Fastest stop and SC-stop counts are shown as race-level references.',
        ],
    },
};

const isValidPositiveNumber = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const average = (values: number[]): number | null => {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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
        values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / values.length;
    return Math.sqrt(variance);
};

const formatSignedSeconds = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(3)}s`;
};

const RacePaceInsightsScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName, initialViewMode, detailType, initialFilter } =
        route.params;

    const [viewMode, setViewMode] = useState<InsightViewMode>(
        initialViewMode === 'teams' ? 'teams' : 'drivers'
    );
    const [selectedDegradationFilter, setSelectedDegradationFilter] = useState<string>(
        OVERALL_FILTER
    );
    const [selectedCompoundPaceFilter, setSelectedCompoundPaceFilter] = useState<string>(
        OVERALL_FILTER
    );
    const [selectedConsistencyFilter, setSelectedConsistencyFilter] =
        useState<ConsistencyFilter>(OVERALL_FILTER);
    const [selectedRacecraftFilter, setSelectedRacecraftFilter] =
        useState<RacecraftFilter>('overtakes');

    const supportsToggle = detailType !== 'pit';
    const effectiveViewMode: InsightViewMode = supportsToggle ? viewMode : 'teams';

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
    const driverEntries = data?.drivers ?? [];
    const safetyCarLaps = data?.raceControlSummary.safetyCarLaps ?? [];
    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const overtakeDrivers = data?.insights.overtakeLeaderboard.drivers ?? [];
    const overtakeTeams = data?.insights.overtakeLeaderboard.teams ?? [];
    const positionDrivers = data?.insights.positionChanges.drivers ?? [];
    const positionTeams = data?.insights.positionChanges.teams ?? [];
    const consistencyDrivers = data?.insights.paceConsistency.drivers ?? [];
    const degradationDriversRaw = data?.insights.tyreDegradation.stints ?? [];
    const pitTeams = data?.insights.pitStrategy.teams ?? [];
    const fastestStop = data?.insights.pitStrategy.fastestStop ?? null;
    const safetyCarPitStops = data?.insights.pitStrategy.safetyCarPitStops ?? 0;

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

    const getFuelLoadForLap = useCallback(
        (lapNumber: number): FuelLoad => {
            if (lapNumber <= fuelLoadBounds.heavyEndLap) return 'heavy';
            if (lapNumber <= fuelLoadBounds.mediumEndLap) return 'medium';
            return 'low';
        },
        [fuelLoadBounds.heavyEndLap, fuelLoadBounds.mediumEndLap]
    );

    const degradationDrivers = useMemo(
        () =>
            [...degradationDriversRaw].sort((a, b) => {
                if (a.deltaFirstToLast == null && b.deltaFirstToLast == null) return 0;
                if (a.deltaFirstToLast == null) return 1;
                if (b.deltaFirstToLast == null) return -1;
                const deltaDiff = a.deltaFirstToLast - b.deltaFirstToLast;
                if (deltaDiff !== 0) return deltaDiff;
                if (a.slope == null && b.slope == null) return 0;
                if (a.slope == null) return 1;
                if (b.slope == null) return -1;
                return a.slope - b.slope;
            }),
        [degradationDriversRaw]
    );

    const teamConsistencyInsights = useMemo<TeamConsistencyInsight[]>(() => {
        const teamSamples = new Map<
            string,
            { teamName: string; driverNumbers: Set<number>; durations: number[] }
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
            const filtered =
                typical == null
                    ? rawDurations
                    : rawDurations.filter(duration => duration <= typical * 1.08);
            const sample = filtered.length >= 5 ? filtered : rawDurations;
            if (sample.length < 5) return;

            const teamName = entry.driver.team;
            const existing = teamSamples.get(teamName) ?? {
                teamName,
                driverNumbers: new Set<number>(),
                durations: [],
            };
            existing.driverNumbers.add(entry.driverNumber);
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
                driverCount: team.driverNumbers.size,
                lapCount: team.durations.length,
                averageLap: avg,
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
                .map(lap => ({ lapNumber: lap.lap_number, duration: lap.lap_duration as number }));

            if (rawLaps.length < 5) return;
            const typical = median(rawLaps.map(lap => lap.duration));
            const filtered =
                typical == null ? rawLaps : rawLaps.filter(lap => lap.duration <= typical * 1.08);
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
                    averageLap: avg,
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

    const teamConsistencyByFuelLoad = useMemo<Record<FuelLoad, TeamFuelConsistencyInsight[]>>(() => {
        const bucketMap: Record<
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
                .map(lap => ({ lapNumber: lap.lap_number, duration: lap.lap_duration as number }));

            if (rawLaps.length < 5) return;
            const typical = median(rawLaps.map(lap => lap.duration));
            const filtered =
                typical == null ? rawLaps : rawLaps.filter(lap => lap.duration <= typical * 1.08);
            const sample = filtered.length >= 5 ? filtered : rawLaps;
            if (sample.length < 5) return;

            sample.forEach(lap => {
                const fuelLoad = getFuelLoadForLap(lap.lapNumber);
                const map = bucketMap[fuelLoad];
                const teamName = entry.driver.team;
                const existing = map.get(teamName) ?? {
                    teamName,
                    driverNumbers: new Set<number>(),
                    durations: [],
                };
                existing.driverNumbers.add(entry.driverNumber);
                existing.durations.push(lap.duration);
                map.set(teamName, existing);
            });
        });

        const result: Record<FuelLoad, TeamFuelConsistencyInsight[]> = {
            heavy: [],
            medium: [],
            low: [],
        };

        FUEL_LOAD_ORDER.forEach(fuelLoad => {
            const rows: TeamFuelConsistencyInsight[] = [];
            bucketMap[fuelLoad].forEach(team => {
                if (team.durations.length < 3) return;
                const avg = average(team.durations);
                const sd = standardDeviation(team.durations);
                if (avg == null || sd == null || avg <= 0) return;
                rows.push({
                    fuelLoad,
                    teamName: team.teamName,
                    driverCount: team.driverNumbers.size,
                    lapCount: team.durations.length,
                    averageLap: avg,
                    standardDeviation: sd,
                    coefficientOfVariation: (sd / avg) * 100,
                });
            });
            rows.sort(
                (a, b) =>
                    a.standardDeviation - b.standardDeviation ||
                    a.coefficientOfVariation - b.coefficientOfVariation
            );
            result[fuelLoad] = rows;
        });

        return result;
    }, [driverEntries, getFuelLoadForLap, safetyCarLapSet]);

    const teamDegradationInsights = useMemo<TeamDegradationInsight[]>(() => {
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

        degradationDrivers.forEach(entry => {
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

        const teams: TeamDegradationInsight[] = [];
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
            const deltaDiff = a.averageDeltaFirstToLast - b.averageDeltaFirstToLast;
            if (deltaDiff !== 0) return deltaDiff;
            if (a.averageSlope == null && b.averageSlope == null) return 0;
            if (a.averageSlope == null) return 1;
            if (b.averageSlope == null) return -1;
            return a.averageSlope - b.averageSlope;
        });

        return teams;
    }, [degradationDrivers]);

    const compoundOptions = useMemo(() => {
        const set = new Set<string>();
        driverEntries.forEach(entry => {
            entry.stints.forEach(stint => {
                if (stint.compound) set.add(stint.compound.toUpperCase());
            });
        });
        return Array.from(set);
    }, [driverEntries]);

    const compoundFilterOptions = useMemo(
        () => [OVERALL_FILTER, ...compoundOptions],
        [compoundOptions]
    );

    useEffect(() => {
        if (detailType !== 'degradation' && detailType !== 'compoundPace') return;
        const normalized =
            initialFilter &&
            (initialFilter === OVERALL_FILTER || compoundOptions.includes(initialFilter))
                ? initialFilter
                : OVERALL_FILTER;
        if (detailType === 'degradation') {
            setSelectedDegradationFilter(normalized);
        } else {
            setSelectedCompoundPaceFilter(normalized);
        }
    }, [compoundOptions, detailType, initialFilter]);

    useEffect(() => {
        if (detailType !== 'consistency') return;
        if (
            initialFilter === OVERALL_FILTER ||
            (initialFilter && FUEL_LOAD_ORDER.includes(initialFilter as FuelLoad))
        ) {
            setSelectedConsistencyFilter((initialFilter ?? OVERALL_FILTER) as ConsistencyFilter);
            return;
        }
        setSelectedConsistencyFilter(OVERALL_FILTER);
    }, [detailType, initialFilter]);

    useEffect(() => {
        if (detailType !== 'racecraft') return;
        if (
            initialFilter === 'overtakes' ||
            initialFilter === 'gains' ||
            initialFilter === 'drops'
        ) {
            setSelectedRacecraftFilter(initialFilter);
            return;
        }
        setSelectedRacecraftFilter('overtakes');
    }, [detailType, initialFilter]);

    const buildDriverDegradationInsights = useCallback(
        (entries: typeof degradationDrivers) => {
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

            const drivers: DriverDegradationInsight[] = [];
            driverMap.forEach(driver => {
                drivers.push({
                    driverNumber: driver.driverNumber,
                    driverName: driver.driverName,
                    teamName: driver.teamName,
                    teamColor: driver.teamColor,
                    stintCount: driver.stintCount,
                    lapCount: driver.lapCount,
                    averageSlope:
                        driver.slopeWeight > 0 ? driver.slopeWeightedTotal / driver.slopeWeight : null,
                    averageDeltaFirstToLast:
                        driver.deltaWeight > 0 ? driver.deltaWeightedTotal / driver.deltaWeight : null,
                });
            });

            drivers.sort((a, b) => {
                if (a.averageDeltaFirstToLast == null && b.averageDeltaFirstToLast == null) return 0;
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

    const driverDegradationInsights = useMemo<DriverDegradationInsight[]>(() => {
        return buildDriverDegradationInsights(degradationDrivers);
    }, [buildDriverDegradationInsights, degradationDrivers]);

    const driverDegradationByCompound = useMemo(() => {
        const map = new Map<string, DriverDegradationInsight[]>();
        compoundOptions.forEach(compound => {
            const filtered = degradationDrivers.filter(
                entry => entry.compound?.toUpperCase() === compound
            );
            map.set(compound, buildDriverDegradationInsights(filtered));
        });
        return map;
    }, [buildDriverDegradationInsights, compoundOptions, degradationDrivers]);

    const teamDegradationByCompound = useMemo(() => {
        const map = new Map<string, TeamDegradationInsight[]>();
        compoundOptions.forEach(compound => {
            const rows = degradationDrivers.filter(entry => entry.compound?.toUpperCase() === compound);
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
            rows.forEach(entry => {
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
            const teams: TeamDegradationInsight[] = [];
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
            map.set(compound, teams);
        });
        return map;
    }, [compoundOptions, degradationDrivers]);

    const driverPaceByCompound = useMemo(() => {
        const map = new Map<string, DriverCompoundStat[]>();
        driverEntries.forEach(entry => {
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                excludedLapNumbers: safetyCarLapSet,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < 3) return;
                const compound = stat.compound.toUpperCase();
                const list = map.get(compound) ?? [];
                list.push({
                    driverName: entry.driver.name,
                    driverNumber: entry.driverNumber,
                    teamName: entry.driver.team,
                    teamColor: entry.driver.teamColor,
                    lapCount: stat.lapCount,
                    avgTime: stat.avgTime,
                });
                map.set(compound, list);
            });
        });
        compoundOptions.forEach(compound => {
            if (!map.has(compound)) map.set(compound, []);
        });
        map.forEach((list, compound) => {
            list.sort((a, b) => a.avgTime - b.avgTime);
            map.set(compound, list);
        });
        return map;
    }, [compoundOptions, driverEntries, safetyCarLapSet]);

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
    }, [compoundOptions, driverEntries, safetyCarLapSet]);

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

    const activeDegradationFilter =
        selectedDegradationFilter === OVERALL_FILTER ||
        compoundOptions.includes(selectedDegradationFilter)
            ? selectedDegradationFilter
            : OVERALL_FILTER;
    const activeDegradationLabel =
        activeDegradationFilter === OVERALL_FILTER
            ? 'Overall'
            : getCompoundName(activeDegradationFilter);
    const activeDriverDegradationRows =
        activeDegradationFilter === OVERALL_FILTER
            ? driverDegradationInsights
            : driverDegradationByCompound.get(activeDegradationFilter) ?? [];
    const activeTeamDegradationRows =
        activeDegradationFilter === OVERALL_FILTER
            ? teamDegradationInsights
            : teamDegradationByCompound.get(activeDegradationFilter) ?? [];

    const activeCompoundPaceFilter =
        selectedCompoundPaceFilter === OVERALL_FILTER ||
        compoundOptions.includes(selectedCompoundPaceFilter)
            ? selectedCompoundPaceFilter
            : OVERALL_FILTER;
    const activeCompoundPaceLabel =
        activeCompoundPaceFilter === OVERALL_FILTER
            ? 'Overall'
            : getCompoundName(activeCompoundPaceFilter);
    const activeDriverPaceRows =
        activeCompoundPaceFilter === OVERALL_FILTER
            ? driverOverallPace
            : driverPaceByCompound.get(activeCompoundPaceFilter) ?? [];
    const activeTeamPaceRows =
        activeCompoundPaceFilter === OVERALL_FILTER
            ? teamOverallPace
            : teamPaceByCompound.get(activeCompoundPaceFilter) ?? [];

    const activeConsistencyLabel =
        selectedConsistencyFilter === OVERALL_FILTER
            ? 'Overall'
            : FUEL_LOAD_LABEL[selectedConsistencyFilter];
    const activeDriverConsistencyRows =
        selectedConsistencyFilter === OVERALL_FILTER
            ? consistencyDrivers
            : driverConsistencyByFuelLoad[selectedConsistencyFilter];
    const activeTeamConsistencyRows =
        selectedConsistencyFilter === OVERALL_FILTER
            ? teamConsistencyInsights
            : teamConsistencyByFuelLoad[selectedConsistencyFilter];
    const racecraftFilterLabel: Record<RacecraftFilter, string> = {
        overtakes: 'Overtakes (Net)',
        gains: 'Position Gains',
        drops: 'Position Drops',
    };
    const activeTeamRacecraftCount =
        selectedRacecraftFilter === 'overtakes'
            ? overtakeTeams.length
            : selectedRacecraftFilter === 'gains'
            ? positionTeams.filter(entry => entry.netGain > 0).length
            : positionTeams.filter(entry => entry.netGain < 0).length;
    const activeDriverRacecraftCount =
        selectedRacecraftFilter === 'overtakes'
            ? overtakeDrivers.length
            : selectedRacecraftFilter === 'gains'
            ? positionDrivers.filter(entry => entry.gain > 0).length
            : positionDrivers.filter(entry => entry.gain < 0).length;

    const rowsCount = useMemo(() => {
        if (detailType === 'degradation') {
            return effectiveViewMode === 'teams'
                ? activeTeamDegradationRows.length
                : activeDriverDegradationRows.length;
        }
        if (detailType === 'racecraft') {
            return effectiveViewMode === 'teams'
                ? activeTeamRacecraftCount
                : activeDriverRacecraftCount;
        }
        if (detailType === 'consistency') {
            return effectiveViewMode === 'teams'
                ? activeTeamConsistencyRows.length
                : activeDriverConsistencyRows.length;
        }
        if (detailType === 'compoundPace') {
            return effectiveViewMode === 'teams'
                ? activeTeamPaceRows.length
                : activeDriverPaceRows.length;
        }
        return pitTeams.length;
    }, [
        activeDriverConsistencyRows.length,
        activeDriverDegradationRows.length,
        activeDriverPaceRows.length,
        activeTeamConsistencyRows.length,
        activeTeamDegradationRows.length,
        activeTeamPaceRows.length,
        activeTeamRacecraftCount,
        detailType,
        effectiveViewMode,
        activeDriverRacecraftCount,
        overtakeDrivers.length,
        overtakeTeams.length,
        pitTeams.length,
        positionDrivers.length,
        positionTeams.length,
    ]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading insights...</Text>
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

    const heroDate = data?.date_start
        ? new Date(data.date_start).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
          })
        : null;

    const meta = DETAIL_META[detailType];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor={semanticColors.danger}
                />
            }
        >
            <View style={styles.heroCard}>
                <Text style={styles.heroSubtitle}>{meetingName || data?.location || 'Race'}</Text>
                <Text style={styles.heroTitle}>{meta.title}</Text>
                <Text style={styles.heroDetail}>{sessionName}</Text>
                {heroDate ? <Text style={styles.heroDate}>{heroDate}</Text> : null}
                <View style={styles.heroStatsRow}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{rowsCount}</Text>
                        <Text style={styles.heroStatLabel}>Rows</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{effectiveViewMode === 'teams' ? 'TEAM' : 'DRIVER'}</Text>
                        <Text style={styles.heroStatLabel}>View</Text>
                    </View>
                </View>
            </View>

            {supportsToggle ? (
                <View style={styles.viewModeCard}>
                    <Text style={styles.viewModeLabel}>View Mode</Text>
                    <View style={styles.viewModeOptions}>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                effectiveViewMode === 'drivers' && styles.filterChipActive,
                            ]}
                            onPress={() => setViewMode('drivers')}
                        >
                            <Text
                                style={[
                                    styles.filterChipLabel,
                                    effectiveViewMode === 'drivers' && styles.filterChipLabelActive,
                                ]}
                            >
                                Drivers
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                effectiveViewMode === 'teams' && styles.filterChipActive,
                            ]}
                            onPress={() => setViewMode('teams')}
                        >
                            <Text
                                style={[
                                    styles.filterChipLabel,
                                    effectiveViewMode === 'teams' && styles.filterChipLabelActive,
                                ]}
                            >
                                Teams
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            <View style={styles.explainCard}>
                <Text style={styles.cardOverline}>How To Read This</Text>
                <Text style={styles.cardTitle}>{meta.subtitle}</Text>
                {meta.bullets.map(line => (
                    <Text key={line} style={styles.cardBody}>
                        {line}
                    </Text>
                ))}
            </View>

            {detailType === 'degradation' ? (
                <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Tyre Degradation Ranking ({activeDegradationLabel})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundFilterOptions.map(filter => {
                            const active = filter === activeDegradationFilter;
                            return (
                                <TouchableOpacity
                                    key={`detail-degradation-filter-${filter}`}
                                    style={[
                                        styles.filterChip,
                                        styles.filterChipInline,
                                        active && styles.filterChipActive,
                                    ]}
                                    onPress={() => setSelectedDegradationFilter(filter)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            active && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {filter === OVERALL_FILTER
                                            ? 'Overall'
                                            : getCompoundName(filter)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {effectiveViewMode === 'teams' ? (
                        activeTeamDegradationRows.length ? (
                            activeTeamDegradationRows.map((entry, index) => (
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
                                    <View style={styles.listInfo}>
                                        <Text style={styles.listName}>{entry.teamName}</Text>
                                        <Text style={styles.listMeta}>
                                            {entry.stintCount} {entry.stintCount === 1 ? 'stint' : 'stints'} •{' '}
                                            {entry.lapCount} laps
                                        </Text>
                                        <Text style={styles.listMeta}>Slope {formatSignedSeconds(entry.averageSlope)}</Text>
                                    </View>
                                    <Text style={styles.listValue}>
                                        {formatSignedSeconds(entry.averageDeltaFirstToLast)}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noData}>No team degradation data for this filter.</Text>
                        )
                    ) : activeDriverDegradationRows.length ? (
                        activeDriverDegradationRows.map((entry, index) => (
                            <View
                                key={`driver-degradation-${entry.driverNumber}`}
                                style={styles.listRow}
                            >
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(entry.teamColor) },
                                    ]}
                                />
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • {entry.stintCount}{' '}
                                        {entry.stintCount === 1 ? 'stint' : 'stints'}
                                    </Text>
                                    <Text style={styles.listMeta}>
                                        {entry.lapCount} laps • Slope {formatSignedSeconds(entry.averageSlope)}
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
                </View>
            ) : null}

            {detailType === 'racecraft' ? (
                <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Racecraft ({racecraftFilterLabel[selectedRacecraftFilter]})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {(['overtakes', 'gains', 'drops'] as RacecraftFilter[]).map(filter => {
                            const active = filter === selectedRacecraftFilter;
                            return (
                                <TouchableOpacity
                                    key={`detail-racecraft-filter-${filter}`}
                                    style={[
                                        styles.filterChip,
                                        styles.filterChipInline,
                                        active && styles.filterChipActive,
                                    ]}
                                    onPress={() => setSelectedRacecraftFilter(filter)}
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
                    {selectedRacecraftFilter === 'overtakes' ? (
                        effectiveViewMode === 'teams' ? (
                            overtakeTeams.length ? (
                                overtakeTeams.map((entry, index) => (
                                    <View key={`team-overtake-${entry.teamName}`} style={styles.listRow}>
                                        <View style={styles.rankPill}>
                                            <Text style={styles.rankText}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.listInfo}>
                                            <Text style={styles.listName}>{entry.teamName}</Text>
                                            <Text style={styles.listMeta}>Made {entry.made} • Suffered {entry.suffered}</Text>
                                        </View>
                                        <Text style={styles.listValue}>{entry.net > 0 ? '+' : ''}{entry.net}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.noData}>No team overtake data.</Text>
                            )
                        ) : overtakeDrivers.length ? (
                            overtakeDrivers.map((entry, index) => (
                                <View key={`driver-overtake-${entry.driverNumber}`} style={styles.listRow}>
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listInfo}>
                                        <Text style={styles.listName}>{entry.driverName}</Text>
                                        <Text style={styles.listMeta}>
                                            {entry.teamName} • Made {entry.made} • Suffered {entry.suffered}
                                        </Text>
                                    </View>
                                    <Text style={styles.listValue}>{entry.net > 0 ? '+' : ''}{entry.net}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noData}>No driver overtake data.</Text>
                        )
                    ) : selectedRacecraftFilter === 'gains' ? (
                        effectiveViewMode === 'teams' ? (
                            positionTeams.filter(entry => entry.netGain > 0).length ? (
                                positionTeams
                                    .filter(entry => entry.netGain > 0)
                                    .map((entry, index) => (
                                        <View key={`team-pos-gain-${entry.teamName}`} style={styles.listRow}>
                                            <View style={styles.rankPill}>
                                                <Text style={styles.rankText}>{index + 1}</Text>
                                            </View>
                                            <View style={styles.listInfo}>
                                                <Text style={styles.listName}>{entry.teamName}</Text>
                                            </View>
                                            <Text style={styles.listValue}>{entry.netGain > 0 ? '+' : ''}{entry.netGain}</Text>
                                        </View>
                                    ))
                            ) : (
                                <Text style={styles.noData}>No team gain data.</Text>
                            )
                        ) : positionDrivers.filter(entry => entry.gain > 0).length ? (
                            positionDrivers
                                .filter(entry => entry.gain > 0)
                                .map((entry, index) => (
                                    <View key={`driver-pos-gain-${entry.driverNumber}`} style={styles.listRow}>
                                        <View style={styles.rankPill}>
                                            <Text style={styles.rankText}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.listInfo}>
                                            <Text style={styles.listName}>{entry.driverName}</Text>
                                            <Text style={styles.listMeta}>{entry.teamName} • P{entry.start} → P{entry.finish}</Text>
                                        </View>
                                        <Text style={styles.listValue}>{entry.gain > 0 ? '+' : ''}{entry.gain}</Text>
                                    </View>
                                ))
                        ) : (
                            <Text style={styles.noData}>No driver gain data.</Text>
                        )
                    ) : effectiveViewMode === 'teams' ? (
                        [...positionTeams].sort((a, b) => a.netGain - b.netGain).filter(entry => entry.netGain < 0)
                            .length ? (
                            [...positionTeams]
                                .sort((a, b) => a.netGain - b.netGain)
                                .filter(entry => entry.netGain < 0)
                                .map((entry, index) => (
                                    <View key={`team-pos-drop-${entry.teamName}`} style={styles.listRow}>
                                        <View style={styles.rankPill}>
                                            <Text style={styles.rankText}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.listInfo}>
                                            <Text style={styles.listName}>{entry.teamName}</Text>
                                        </View>
                                        <Text style={styles.listValue}>{entry.netGain}</Text>
                                    </View>
                                ))
                        ) : (
                            <Text style={styles.noData}>No team drops recorded.</Text>
                        )
                    ) : [...positionDrivers].sort((a, b) => a.gain - b.gain).filter(entry => entry.gain < 0)
                          .length ? (
                        [...positionDrivers]
                            .sort((a, b) => a.gain - b.gain)
                            .filter(entry => entry.gain < 0)
                            .map((entry, index) => (
                                <View key={`driver-pos-drop-${entry.driverNumber}`} style={styles.listRow}>
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listInfo}>
                                        <Text style={styles.listName}>{entry.driverName}</Text>
                                        <Text style={styles.listMeta}>{entry.teamName} • P{entry.start} → P{entry.finish}</Text>
                                    </View>
                                    <Text style={styles.listValue}>{entry.gain}</Text>
                                </View>
                            ))
                    ) : (
                        <Text style={styles.noData}>No driver drops recorded.</Text>
                    )}
                </View>
            ) : null}

            {detailType === 'consistency' ? (
                <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Pace Consistency ({activeConsistencyLabel})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {[OVERALL_FILTER, ...FUEL_LOAD_ORDER].map(filter => {
                            const active = filter === selectedConsistencyFilter;
                            return (
                                <TouchableOpacity
                                    key={`detail-consistency-filter-${filter}`}
                                    style={[
                                        styles.filterChip,
                                        styles.filterChipInline,
                                        active && styles.filterChipActive,
                                    ]}
                                    onPress={() =>
                                        setSelectedConsistencyFilter(filter as ConsistencyFilter)
                                    }
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
                    {effectiveViewMode === 'teams' ? (
                        activeTeamConsistencyRows.length ? (
                            activeTeamConsistencyRows.map((entry, index) => (
                                <View key={`team-consistency-${entry.teamName}`} style={styles.listRow}>
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listInfo}>
                                        <Text style={styles.listName}>{entry.teamName}</Text>
                                        <Text style={styles.listMeta}>
                                            {entry.driverCount} {entry.driverCount === 1 ? 'driver' : 'drivers'} •{' '}
                                            {entry.lapCount} laps • CV {entry.coefficientOfVariation.toFixed(2)}%
                                        </Text>
                                    </View>
                                    <Text style={styles.listValue}>{entry.standardDeviation.toFixed(3)}s</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noData}>No team consistency data for this filter.</Text>
                        )
                    ) : activeDriverConsistencyRows.length ? (
                        activeDriverConsistencyRows.map((entry, index) => (
                            <View key={`driver-consistency-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • {entry.lapCount} laps • CV {entry.coefficientOfVariation.toFixed(2)}%
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{entry.standardDeviation.toFixed(3)}s</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No driver consistency data for this filter.</Text>
                    )}
                </View>
            ) : null}

            {detailType === 'compoundPace' ? (
                <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Average Pace ({activeCompoundPaceLabel})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundFilterOptions.map(filter => {
                            const active = filter === activeCompoundPaceFilter;
                            return (
                                <TouchableOpacity
                                    key={`detail-compound-pace-filter-${filter}`}
                                    style={[
                                        styles.filterChip,
                                        styles.filterChipInline,
                                        active && styles.filterChipActive,
                                    ]}
                                    onPress={() => setSelectedCompoundPaceFilter(filter)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            active && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {filter === OVERALL_FILTER
                                            ? 'Overall'
                                            : getCompoundName(filter)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {(effectiveViewMode === 'teams' ? activeTeamPaceRows : activeDriverPaceRows).length ? (
                        (effectiveViewMode === 'teams' ? activeTeamPaceRows : activeDriverPaceRows).map(
                            (entry, index) => (
                                <View
                                    key={`compound-row-${activeCompoundPaceFilter}-${effectiveViewMode}-${index}`}
                                    style={styles.listRow}
                                >
                                    <View style={styles.rankPill}>
                                        <Text style={styles.rankText}>{index + 1}</Text>
                                    </View>
                                    <View style={styles.listInfo}>
                                        <Text style={styles.listName}>
                                            {'driverName' in entry ? entry.driverName : entry.teamName}
                                        </Text>
                                        <Text style={styles.listMeta}>
                                            {'driverName' in entry
                                                ? `${entry.teamName} • ${entry.lapCount} laps`
                                                : `${entry.lapCount} laps`}
                                        </Text>
                                    </View>
                                    <Text style={styles.listValue}>{formatLapTime(entry.avgTime)}</Text>
                                </View>
                            )
                        )
                    ) : (
                        <Text style={styles.noData}>No representative laps for this filter.</Text>
                    )}
                </View>
            ) : null}

            {detailType === 'pit' ? (
                <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Team Pit Strategy Ranking</Text>
                    {pitTeams.length ? (
                        pitTeams.map((entry, index) => (
                            <View key={`team-pit-${entry.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(entry.teamColor) },
                                    ]}
                                />
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.teamName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.stopCount} stops • avg{' '}
                                        {entry.averageStop ? `${entry.averageStop.toFixed(2)}s` : '—'}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>
                                    {entry.medianStop ? `${entry.medianStop.toFixed(2)}s` : '—'}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No team pit data for this race.</Text>
                    )}
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>Fastest stop:</Text>
                        <Text style={styles.highlightValue}>
                            {fastestStop
                                ? `${fastestStop.driverName} (${fastestStop.duration.toFixed(2)}s)`
                                : '—'}
                        </Text>
                    </View>
                    <View style={styles.highlightRow}>
                        <Text style={styles.highlightLabel}>Stops under SC:</Text>
                        <Text style={styles.highlightValue}>{safetyCarPitStops}</Text>
                    </View>
                </View>
            ) : null}

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default RacePaceInsightsScreen;

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
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.base,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        marginTop: spacing.xxs,
        color: semanticColors.surface,
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.bold,
    },
    heroDetail: {
        marginTop: spacing.xxs,
        color: 'rgba(255,255,255,0.8)',
        fontSize: typography.size.base,
    },
    heroDate: {
        marginTop: spacing.xs,
        color: 'rgba(255,255,255,0.7)',
    },
    heroStatsRow: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
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
        marginTop: spacing.xxs,
        color: 'rgba(255,255,255,0.68)',
        fontSize: typography.size.sm,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    heroStatDivider: {
        width: StyleSheet.hairlineWidth,
        height: 28,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    viewModeCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    viewModeLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    viewModeOptions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterScroll: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    filterContent: {
        paddingVertical: spacing.xxs,
    },
    filterChip: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.borderStrong,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginLeft: spacing.xs,
        backgroundColor: semanticColors.surface,
    },
    filterChipActive: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    filterChipLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        fontWeight: typography.weight.semibold,
    },
    filterChipLabelActive: {
        color: semanticColors.surface,
    },
    filterChipInline: {
        marginLeft: 0,
        marginRight: spacing.xs,
    },
    explainCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    cardOverline: {
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },
    cardTitle: {
        marginBottom: spacing.xs,
        fontSize: typography.size.lg,
        color: semanticColors.textPrimary,
        fontWeight: typography.weight.bold,
    },
    cardBody: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        lineHeight: 20,
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
    },
    listTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSectionTitle: {
        marginTop: spacing.md,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
        fontWeight: typography.weight.bold,
    },
    fuelBlock: {
        marginTop: spacing.sm,
    },
    fuelTitle: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.xs,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.borderMuted,
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: radius.lg,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    rankText: {
        fontWeight: typography.weight.bold,
        color: '#5C6BFF',
    },
    teamDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.sm,
    },
    listInfo: {
        flex: 1,
    },
    listName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    listValue: {
        marginLeft: spacing.sm,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
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
        color: semanticColors.textPrimary,
        fontWeight: typography.weight.bold,
        flexShrink: 1,
        textAlign: 'right',
    },
    noData: {
        textAlign: 'center',
        color: semanticColors.textMuted,
        fontSize: typography.size.sm,
        paddingVertical: spacing.sm,
    },
    refreshHint: {
        paddingVertical: spacing.xl,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
