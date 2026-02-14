import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getQualifyingSessionDetail } from '../../../../backend/service/openf1Service';
import type { Lap, QualifyingSessionDetail, SessionDriverData } from '../../../../backend/types';
import { formatLapTime } from '../../../../shared/time';
import TyreCompoundBadge from '../../../component/common/TyreCompoundBadge';
import {
    formatSessionGap,
    formatSessionResult,
    getDriverInitials,
    getResultStatusLabel,
    getTeamColorHex,
} from '../../../../utils/driver';

type DriverOption = {
    driverNumber: number;
    name: string;
    team: string;
    teamColor?: string | null;
};

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
    sessionName?: string;
    meetingName?: string;
    driverData?: SessionDriverData | null;
    driverOptions?: DriverOption[];
};

type DriverState = {
    data: QualifyingSessionDetail | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
};

type PhaseLabel = 'Q1' | 'Q2' | 'Q3';

type PhaseExpandedState = Record<PhaseLabel, boolean>;

const PHASES: PhaseLabel[] = ['Q1', 'Q2', 'Q3'];

const isValidNumber = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const formatSector = (value: number | null | undefined): string =>
    isValidNumber(value) ? `${value.toFixed(3)}s` : '—';

const formatDelta = (value: number | null): { label: string; positive: boolean } => {
    if (value == null) {
        return { label: '—', positive: true };
    }

    if (value > 0) {
        return { label: `- ${value.toFixed(3)}s`, positive: true };
    }

    if (value < 0) {
        return { label: `+ ${Math.abs(value).toFixed(3)}s`, positive: false };
    }

    return { label: 'No change', positive: true };
};

const parseDate = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
};

const derivePhaseStarts = (detail: QualifyingSessionDetail | null): Array<{ phase: number; start: number }> => {
    if (!detail) return [];

    const starts = new Map<number, number>();
    detail.raceControl.forEach(entry => {
        const phase = entry.qualifyingPhase;
        if (!phase || phase < 1 || phase > 3) return;
        const ms = parseDate(entry.date);
        if (ms == null) return;
        const existing = starts.get(phase);
        if (existing == null || ms < existing) {
            starts.set(phase, ms);
        }
    });

    return Array.from(starts.entries())
        .map(([phase, start]) => ({ phase, start }))
        .sort((a, b) => a.start - b.start);
};

const derivePhaseLaps = (
    laps: Lap[],
    resultDurations: number[],
    phaseStarts: Array<{ phase: number; start: number }>
): Record<PhaseLabel, Lap[]> => {
    const grouped: Record<PhaseLabel, Lap[]> = {
        Q1: [],
        Q2: [],
        Q3: [],
    };

    const sortedLaps = [...laps].sort((a, b) => a.lap_number - b.lap_number);
    if (!sortedLaps.length) {
        return grouped;
    }

    if (phaseStarts.length) {
        sortedLaps.forEach(lap => {
            const lapMs = parseDate(lap.date_start);
            if (lapMs == null) {
                grouped.Q1.push(lap);
                return;
            }

            let resolvedPhase = phaseStarts[0].phase;
            for (let i = 0; i < phaseStarts.length; i++) {
                const current = phaseStarts[i];
                const next = phaseStarts[i + 1];
                if (lapMs >= current.start && (!next || lapMs < next.start)) {
                    resolvedPhase = current.phase;
                    break;
                }
            }

            if (resolvedPhase === 3) grouped.Q3.push(lap);
            else if (resolvedPhase === 2) grouped.Q2.push(lap);
            else grouped.Q1.push(lap);
        });

        return grouped;
    }

    const phaseCount =
        isValidNumber(resultDurations[2]) ? 3 : isValidNumber(resultDurations[1]) ? 2 : 1;

    sortedLaps.forEach((lap, index) => {
        const bucket = Math.min(
            phaseCount,
            Math.floor((index * phaseCount) / Math.max(sortedLaps.length, 1)) + 1
        );
        if (bucket === 3) grouped.Q3.push(lap);
        else if (bucket === 2) grouped.Q2.push(lap);
        else grouped.Q1.push(lap);
    });

    return grouped;
};

const getFastestLapDuration = (laps: Lap[]): number | null => {
    const values = laps.map(lap => lap.lap_duration).filter(isValidNumber);
    if (!values.length) return null;
    return Math.min(...values);
};

const buildDriverOptions = (detail: QualifyingSessionDetail | null): DriverOption[] => {
    if (!detail) return [];

    const entryMap = new Map(
        detail.drivers.map(entry => [
            entry.driverNumber,
            {
                driverNumber: entry.driverNumber,
                name: entry.driver.name,
                team: entry.driver.team,
                teamColor: entry.driver.teamColor,
            },
        ])
    );

    const ordered: DriverOption[] = [];
    detail.classification.forEach(row => {
        const option = entryMap.get(row.driverNumber);
        if (!option) return;
        ordered.push(option);
        entryMap.delete(row.driverNumber);
    });

    entryMap.forEach(value => ordered.push(value));
    return ordered;
};

const DriverQualifyingDetailsScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        sessionKey,
        sessionName,
        meetingName,
        driverData: driverDataParam,
        driverOptions: driverOptionsParam,
    } = route.params;

    const [selectedDriverNumber, setSelectedDriverNumber] = useState(driverNumber);
    const [phaseExpanded, setPhaseExpanded] = useState<PhaseExpandedState>({
        Q1: true,
        Q2: true,
        Q3: true,
    });

    const [state, setState] = useState<DriverState>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    const fetchData = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const detail = await getQualifyingSessionDetail(sessionKey);
                setState({
                    data: detail,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    data: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load qualifying detail',
                });
            }
        },
        [sessionKey]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setSelectedDriverNumber(driverNumber);
    }, [driverNumber]);

    const handleRefresh = useCallback(() => {
        fetchData(true);
    }, [fetchData]);

    const handleSelectDriver = useCallback((target: number) => {
        setSelectedDriverNumber(target);
    }, []);

    const togglePhase = useCallback((phase: PhaseLabel) => {
        setPhaseExpanded(prev => ({
            ...prev,
            [phase]: !prev[phase],
        }));
    }, []);

    const driverOptions = useMemo(() => {
        const fromDetail = buildDriverOptions(state.data);
        if (fromDetail.length) return fromDetail;
        return driverOptionsParam ?? [];
    }, [driverOptionsParam, state.data]);

    const selectedDriverData = useMemo(() => {
        if (state.data) {
            return (
                state.data.drivers.find(entry => entry.driverNumber === selectedDriverNumber) ?? null
            );
        }

        if (driverDataParam && driverDataParam.driverNumber === selectedDriverNumber) {
            return driverDataParam;
        }

        return null;
    }, [driverDataParam, selectedDriverNumber, state.data]);

    const resultDurations = useMemo(() => {
        if (!selectedDriverData || !Array.isArray(selectedDriverData.sessionResult?.duration)) {
            return [];
        }
        return selectedDriverData.sessionResult.duration as number[];
    }, [selectedDriverData]);

    const phaseStarts = useMemo(() => derivePhaseStarts(state.data), [state.data]);

    const lapsByPhase = useMemo(() => {
        if (!selectedDriverData) {
            return { Q1: [] as Lap[], Q2: [] as Lap[], Q3: [] as Lap[] };
        }

        return derivePhaseLaps(selectedDriverData.laps, resultDurations, phaseStarts);
    }, [phaseStarts, resultDurations, selectedDriverData]);

    const selectedClassification = useMemo(() => {
        if (!state.data) return null;
        return state.data.classification.find(row => row.driverNumber === selectedDriverNumber) ?? null;
    }, [selectedDriverNumber, state.data]);

    const fastestLap = useMemo(() => {
        if (!selectedDriverData) return null;
        const valid = selectedDriverData.laps.filter(lap => isValidNumber(lap.lap_duration));
        if (!valid.length) return null;
        return valid.reduce((best, lap) =>
            (lap.lap_duration as number) < (best.lap_duration as number) ? lap : best
        );
    }, [selectedDriverData]);

    const idealLap = useMemo(() => {
        if (!selectedDriverData) return null;

        const bestS1 = Math.min(
            ...selectedDriverData.laps
                .map(lap => lap.duration_sector_1)
                .filter(isValidNumber)
        );
        const bestS2 = Math.min(
            ...selectedDriverData.laps
                .map(lap => lap.duration_sector_2)
                .filter(isValidNumber)
        );
        const bestS3 = Math.min(
            ...selectedDriverData.laps
                .map(lap => lap.duration_sector_3)
                .filter(isValidNumber)
        );

        if (!Number.isFinite(bestS1) || !Number.isFinite(bestS2) || !Number.isFinite(bestS3)) {
            return null;
        }

        return bestS1 + bestS2 + bestS3;
    }, [selectedDriverData]);

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading qualifying driver data...</Text>
            </View>
        );
    }

    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error}</Text>
            </View>
        );
    }

    if (!selectedDriverData) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Driver Not Found</Text>
                <Text style={styles.errorMessage}>No qualifying data available for this driver.</Text>
            </View>
        );
    }

    const result = selectedDriverData.sessionResult;
    const headerColor = getTeamColorHex(selectedDriverData.driver.teamColor);
    const driverImageSource = selectedDriverData.driver.headshotUrl
        ? { uri: selectedDriverData.driver.headshotUrl }
        : null;

    const q1 = isValidNumber(resultDurations[0]) ? resultDurations[0] : null;
    const q2 = isValidNumber(resultDurations[1]) ? resultDurations[1] : null;
    const q3 = isValidNumber(resultDurations[2]) ? resultDurations[2] : null;

    const fastestByPhase: Record<PhaseLabel, number | null> = {
        Q1: q1 ?? getFastestLapDuration(lapsByPhase.Q1),
        Q2: q2 ?? getFastestLapDuration(lapsByPhase.Q2),
        Q3: q3 ?? getFastestLapDuration(lapsByPhase.Q3),
    };

    const q1ToQ2 = q1 != null && q2 != null ? q1 - q2 : null;
    const q2ToQ3 = q2 != null && q3 != null ? q2 - q3 : null;
    const q1ToBest = q1 != null && isValidNumber(fastestLap?.lap_duration) ? q1 - (fastestLap?.lap_duration as number) : null;

    const q1ToQ2Label = formatDelta(q1ToQ2);
    const q2ToQ3Label = formatDelta(q2ToQ3);
    const q1ToBestLabel = formatDelta(q1ToBest);

    const idealVsFastestDelta =
        idealLap != null && isValidNumber(fastestLap?.lap_duration)
            ? (fastestLap?.lap_duration as number) - idealLap
            : null;
    const potentialLabel =
        idealVsFastestDelta == null
            ? '—'
            : idealVsFastestDelta >= 0
                ? `-${idealVsFastestDelta.toFixed(3)}s`
                : `+${Math.abs(idealVsFastestDelta).toFixed(3)}s`;
    const potentialPositive = idealVsFastestDelta != null && idealVsFastestDelta >= 0;

    const statusLabel = getResultStatusLabel(result, 'Qualifying');
    const gapToPole = selectedClassification?.gapToPole ?? formatSessionGap(result?.gap_to_leader ?? null);
    const gapLabel = selectedClassification?.position === 1 ? 'Pole Gap' : 'Gap to Pole';

    const stintInfoByLap = new Map<number, { compound: string; tyreAgeAtLap: number; isNew: boolean }>();
    selectedDriverData.stints.forEach(stint => {
        for (let lap = stint.lap_start; lap <= stint.lap_end; lap++) {
            if (!stintInfoByLap.has(lap)) {
                const tyreAgeAtLap = Math.max(0, (stint.tyre_age_at_start ?? 0) + (lap - stint.lap_start));
                stintInfoByLap.set(lap, {
                    compound: stint.compound,
                    tyreAgeAtLap,
                    isNew: tyreAgeAtLap <= 1,
                });
            }
        }
    });

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            {driverOptions.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.driverSwitchScroll}
                    contentContainerStyle={styles.driverSwitchContent}
                >
                    {driverOptions.map(option => {
                        const active = option.driverNumber === selectedDriverNumber;
                        return (
                            <TouchableOpacity
                                key={option.driverNumber}
                                style={[
                                    styles.driverChip,
                                    active && [
                                        styles.driverChipActive,
                                        { borderColor: getTeamColorHex(option.teamColor) },
                                    ],
                                ]}
                                activeOpacity={0.85}
                                onPress={() => handleSelectDriver(option.driverNumber)}
                            >
                                <Text style={[styles.driverChipName, active && styles.driverChipNameActive]}>
                                    {option.name}
                                </Text>
                                <Text style={[styles.driverChipNumber, active && styles.driverChipNumberActive]}>
                                    #{option.driverNumber}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : null}

            <View style={[styles.heroCard, { backgroundColor: headerColor }]}> 
                <View style={styles.heroRow}>
                    <View style={styles.heroTextBlock}>
                        <Text style={styles.heroSubtitle}>Qualifying</Text>
                        <Text style={styles.heroName}>{selectedDriverData.driver.name}</Text>
                        <Text style={styles.heroTeam}>{selectedDriverData.driver.team}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>#{selectedDriverData.driver.number}</Text>
                            </View>
                            <View style={[styles.heroChip, styles.heroChipMuted]}>
                                <Text style={[styles.heroChipText, styles.heroChipTextMuted]}>{statusLabel}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroAvatar}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.heroImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>{getDriverInitials(selectedDriverData.driver.name)}</Text>
                        )}
                    </View>
                </View>
                <View style={styles.heroStatRow}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{formatSessionResult(result)}</Text>
                        <Text style={styles.heroStatLabel}>Result</Text>
                    </View>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{formatLapTime(fastestLap?.lap_duration)}</Text>
                        <Text style={styles.heroStatLabel}>Fastest Lap</Text>
                    </View>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{gapToPole}</Text>
                        <Text style={styles.heroStatLabel}>{gapLabel}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Ideal Lap vs Fastest Lap</Text>
                <View style={styles.metricRow}>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Fastest</Text>
                        <Text style={styles.metricValue}>{formatLapTime(fastestLap?.lap_duration)}</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Ideal</Text>
                        <Text style={styles.metricValue}>{formatLapTime(idealLap)}</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Potential</Text>
                        <Text
                            style={[
                                styles.metricValue,
                                idealVsFastestDelta != null &&
                                    (potentialPositive ? styles.positiveValue : styles.negativeValue),
                            ]}
                        >
                            {potentialLabel}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Fastest Time Per Phase</Text>
                <View style={styles.metricRow}>
                    {PHASES.map(phase => (
                        <View key={`phase-fastest-${phase}`} style={styles.metricCard}>
                            <Text style={styles.metricLabel}>{phase}</Text>
                            <Text style={styles.metricValue}>{formatLapTime(fastestByPhase[phase])}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Session Improvements</Text>
                <Text style={styles.cardSubtitle}>Shows improvement or regression across Q1, Q2, Q3</Text>
                <View style={styles.deltaRow}>
                    <Text style={styles.deltaLabel}>Q1 → Q2</Text>
                    <Text style={[styles.deltaValue, !q1ToQ2Label.positive && styles.deltaValueNegative]}>
                        {q1ToQ2Label.label}
                    </Text>
                </View>
                <View style={styles.deltaRow}>
                    <Text style={styles.deltaLabel}>Q2 → Q3</Text>
                    <Text style={[styles.deltaValue, !q2ToQ3Label.positive && styles.deltaValueNegative]}>
                        {q2ToQ3Label.label}
                    </Text>
                </View>
                <View style={styles.deltaRowLast}>
                    <Text style={styles.deltaLabel}>Q1 → Best</Text>
                    <Text style={[styles.deltaValue, !q1ToBestLabel.positive && styles.deltaValueNegative]}>
                        {q1ToBestLabel.label}
                    </Text>
                </View>
            </View>

            {PHASES.map(phase => {
                const laps = lapsByPhase[phase] ?? [];
                const expanded = phaseExpanded[phase];
                const fastestLapInPhase = laps.reduce<Lap | null>((best, lap) => {
                    if (!isValidNumber(lap.lap_duration)) return best;
                    if (!best || (lap.lap_duration as number) < (best.lap_duration as number)) {
                        return lap;
                    }
                    return best;
                }, null);
                return (
                    <View key={phase} style={styles.card}>
                        <View style={styles.phaseHeader}>
                            <View>
                                <Text style={styles.cardTitle}>{phase} Laps</Text>
                                <Text style={styles.cardSubtitle}>
                                    {laps.length} {laps.length === 1 ? 'lap' : 'laps'} recorded
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.phaseToggle} onPress={() => togglePhase(phase)}>
                                <Text style={styles.phaseToggleText}>{expanded ? 'Hide' : 'Show'}</Text>
                            </TouchableOpacity>
                        </View>
                        {expanded ? (
                            laps.length ? (
                                laps.map((lap, index) => {
                                    const stintInfo = stintInfoByLap.get(lap.lap_number);
                                    const isFastestInPhase =
                                        fastestLapInPhase?.lap_number === lap.lap_number &&
                                        fastestLapInPhase?.date_start === lap.date_start;
                                    return (
                                        <View
                                            key={`${phase}-${lap.lap_number}-${index}`}
                                            style={[
                                                styles.lapRow,
                                                isFastestInPhase && styles.fastestLapRow,
                                                index === laps.length - 1 && styles.lapRowLast,
                                            ]}
                                        >
                                            <View style={styles.lapHeaderRow}>
                                                <View style={styles.lapInfoLeft}>
                                                    <TyreCompoundBadge compound={stintInfo?.compound ?? 'UNKNOWN'} size={28} />
                                                    <Text style={styles.lapNumber}>Lap {lap.lap_number}</Text>
                                                    <Text
                                                        style={[
                                                            styles.tyreState,
                                                            stintInfo?.isNew ? styles.tyreStateNew : styles.tyreStateUsed,
                                                        ]}
                                                    >
                                                        {stintInfo?.isNew
                                                            ? 'New'
                                                            : `Used (${stintInfo?.tyreAgeAtLap ?? 0} laps)`}
                                                    </Text>
                                                </View>
                                                <View style={styles.lapTimeBlock}>
                                                    {isFastestInPhase ? (
                                                        <Text style={styles.fastestChip}>FASTEST</Text>
                                                    ) : null}
                                                    <Text style={styles.lapTime}>{formatLapTime(lap.lap_duration)}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.sectorTileRow}>
                                                <View style={styles.sectorTile}>
                                                    <Text style={styles.sectorTileLabel}>S1</Text>
                                                    <Text style={styles.sectorTileValue}>{formatSector(lap.duration_sector_1)}</Text>
                                                </View>
                                                <View style={styles.sectorTile}>
                                                    <Text style={styles.sectorTileLabel}>S2</Text>
                                                    <Text style={styles.sectorTileValue}>{formatSector(lap.duration_sector_2)}</Text>
                                                </View>
                                                <View style={styles.sectorTile}>
                                                    <Text style={styles.sectorTileLabel}>S3</Text>
                                                    <Text style={styles.sectorTileValue}>{formatSector(lap.duration_sector_3)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.noData}>No laps recorded in {phase}.</Text>
                            )
                        ) : null}
                    </View>
                );
            })}

            <Text style={styles.footerHint}>
                {(meetingName || sessionName) ? `${meetingName || sessionName} qualifying detail` : 'Qualifying detail'}
            </Text>
        </ScrollView>
    );
};

export default DriverQualifyingDetailsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    contentContainer: {
        paddingBottom: 32,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F5F5F7',
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
    driverSwitchScroll: {
        marginHorizontal: 16,
        marginBottom: 12,
    },
    driverSwitchContent: {
        paddingVertical: 4,
    },
    driverChip: {
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D9DEEC',
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
        backgroundColor: '#FFFFFF',
    },
    driverChipActive: {
        backgroundColor: '#15151E',
        borderColor: '#15151E',
    },
    driverChipName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#5F6683',
    },
    driverChipNameActive: {
        color: '#FFFFFF',
    },
    driverChipNumber: {
        fontSize: 11,
        color: '#8A90AA',
        marginTop: 2,
    },
    driverChipNumberActive: {
        color: 'rgba(255,255,255,0.85)',
    },
    heroCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 28,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroTextBlock: {
        flex: 1,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 13,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        color: '#FFF',
        fontSize: 25,
        fontWeight: '800',
        marginTop: 8,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: 15,
        marginTop: 4,
    },
    heroChipRow: {
        flexDirection: 'row',
        marginTop: 16,
    },
    heroChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginRight: 10,
    },
    heroChipMuted: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroChipText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.4,
    },
    heroChipTextMuted: {
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '600',
    },
    heroAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        marginLeft: 16,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitials: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: 24,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 22,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    card: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 4,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    cardSubtitle: {
        marginTop: 4,
        color: '#7A7E92',
        fontSize: 13,
    },
    metricRow: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 10,
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#F7F8FB',
        borderRadius: 14,
        padding: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E6F0',
    },
    metricLabel: {
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: '#7A7E92',
    },
    metricValue: {
        marginTop: 6,
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    positiveValue: {
        color: '#1F8A4D',
    },
    negativeValue: {
        color: '#B93B32',
    },
    phaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    phaseToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#EFF0F7',
    },
    phaseToggleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4D5166',
    },
    deltaRow: {
        marginTop: 12,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E6E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    deltaRowLast: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    deltaLabel: {
        fontSize: 14,
        color: '#4B5168',
        fontWeight: '600',
    },
    deltaValue: {
        fontSize: 14,
        color: '#1F8A4D',
        fontWeight: '700',
        textAlign: 'right',
    },
    deltaValueNegative: {
        color: '#B93B32',
    },
    sectorRow: {
        marginTop: 12,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E6E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectorRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    sectorLabel: {
        fontSize: 12,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        color: '#7A7E92',
    },
    sectorTime: {
        marginTop: 4,
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    sectorRank: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2A3A78',
    },
    lapRow: {
        marginTop: 12,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E6E8F0',
    },
    fastestLapRow: {
        backgroundColor: '#F1F8EE',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    lapRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    lapHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lapInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        flex: 1,
    },
    lapNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D2338',
    },
    tyreState: {
        fontSize: 12,
        fontWeight: '700',
    },
    tyreStateNew: {
        color: '#1F8A4D',
    },
    tyreStateUsed: {
        color: '#7A7E92',
    },
    lapTimeBlock: {
        alignItems: 'flex-end',
        marginLeft: 8,
    },
    fastestChip: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1F8A4D',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    lapTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    sectorTileRow: {
        marginTop: 6,
        flexDirection: 'row',
        gap: 8,
    },
    sectorTile: {
        flex: 1,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E6F0',
        backgroundColor: '#F7F8FB',
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    sectorTileLabel: {
        fontSize: 11,
        color: '#7A7E92',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    sectorTileValue: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '700',
        color: '#6F748C',
    },
    noData: {
        marginTop: 10,
        fontSize: 13,
        color: '#8A8FA6',
        textAlign: 'center',
    },
    footerHint: {
        textAlign: 'center',
        color: '#9A9FB5',
        paddingVertical: 22,
        fontSize: 12,
    },
});
