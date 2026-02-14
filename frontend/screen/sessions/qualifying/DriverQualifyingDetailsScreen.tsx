import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
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
import { Ionicons } from '@expo/vector-icons';
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
                <ActivityIndicator size="large" color={semanticColors.danger} />
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
                    tintColor={semanticColors.danger}
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
                                                        <View style={styles.fastestChipBadge}>
                                                            <Ionicons
                                                                name="timer-outline"
                                                                size={10}
                                                                color="#5A3CA8"
                                                            />
                                                            <Text style={styles.fastestChip}>FASTEST</Text>
                                                        </View>
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
        backgroundColor: semanticColors.background,
    },
    contentContainer: {
        paddingBottom: spacing.xxl,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.background,
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
        color: semanticColors.textSecondary,
        textAlign: 'center',
    },
    driverSwitchScroll: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    driverSwitchContent: {
        paddingVertical: spacing.xxs,
    },
    driverChip: {
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D9DEEC',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginRight: spacing.xs,
        backgroundColor: semanticColors.surface,
    },
    driverChipActive: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    driverChipName: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: '#5F6683',
    },
    driverChipNameActive: {
        color: semanticColors.surface,
    },
    driverChipNumber: {
        fontSize: typography.size.xs,
        color: '#8A90AA',
        marginTop: 2,
    },
    driverChipNumberActive: {
        color: 'rgba(255,255,255,0.85)',
    },
    heroCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.xxl,
        shadowColor: colors.neutral.black,
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
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        color: semanticColors.surface,
        fontSize: 25,
        fontWeight: typography.weight.heavy,
        marginTop: spacing.xs,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: typography.size.base,
        marginTop: spacing.xxs,
    },
    heroChipRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    heroChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginRight: spacing.sm,
    },
    heroChipMuted: {
        backgroundColor: overlays.white08,
    },
    heroChipText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
        letterSpacing: 0.4,
    },
    heroChipTextMuted: {
        color: 'rgba(255,255,255,0.85)',
        fontWeight: typography.weight.semibold,
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
        marginLeft: spacing.md,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitials: {
        fontSize: 28,
        fontWeight: typography.weight.heavy,
        color: semanticColors.surface,
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: spacing.xl,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: radius.xl,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.sm,
        marginTop: spacing.xxs,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    card: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        padding: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 4,
    },
    cardTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    cardSubtitle: {
        marginTop: spacing.xxs,
        color: semanticColors.textMuted,
        fontSize: typography.size.sm,
    },
    metricRow: {
        marginTop: spacing.md,
        flexDirection: 'row',
        gap: spacing.sm,
    },
    metricCard: {
        flex: 1,
        backgroundColor: semanticColors.surfaceMuted,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    metricLabel: {
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
    },
    metricValue: {
        marginTop: spacing.xs,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    positiveValue: {
        color: semanticColors.success,
    },
    negativeValue: {
        color: '#B93B32',
    },
    phaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    phaseToggle: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: '#EFF0F7',
    },
    phaseToggleText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textSecondary,
    },
    deltaRow: {
        marginTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    deltaRowLast: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    deltaLabel: {
        fontSize: typography.size.base,
        color: '#4B5168',
        fontWeight: typography.weight.semibold,
    },
    deltaValue: {
        fontSize: typography.size.base,
        color: semanticColors.success,
        fontWeight: typography.weight.bold,
        textAlign: 'right',
    },
    deltaValueNegative: {
        color: '#B93B32',
    },
    sectorRow: {
        marginTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectorRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    sectorLabel: {
        fontSize: typography.size.sm,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
    },
    sectorTime: {
        marginTop: spacing.xxs,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sectorRank: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.info,
    },
    lapRow: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.border,
    },
    fastestLapRow: {
        backgroundColor: '#f2edff',
        borderRadius: radius.md,
        marginHorizontal: -10,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: '#E2DAFF',
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
        gap: spacing.sm,
        flexWrap: 'wrap',
        flex: 1,
    },
    lapNumber: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1D2338',
    },
    tyreState: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
    },
    tyreStateNew: {
        color: semanticColors.success,
    },
    tyreStateUsed: {
        color: semanticColors.textMuted,
    },
    lapTimeBlock: {
        alignItems: 'flex-end',
        marginLeft: spacing.xs,
    },
    fastestChipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
        backgroundColor: '#F8F5FF',
        marginBottom: 2,
    },
    fastestChip: {
        fontSize: 10,
        fontWeight: typography.weight.heavy,
        color: '#5A3CA8',
        letterSpacing: 0.6,
    },
    lapTime: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sectorTileRow: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        gap: spacing.xs,
    },
    sectorTile: {
        flex: 1,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        backgroundColor: semanticColors.surfaceMuted,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    sectorTileLabel: {
        fontSize: typography.size.xs,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
        fontWeight: typography.weight.bold,
    },
    sectorTileValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#6F748C',
    },
    noData: {
        marginTop: spacing.sm,
        fontSize: typography.size.sm,
        color: '#8A8FA6',
        textAlign: 'center',
    },
    footerHint: {
        textAlign: 'center',
        color: '#9A9FB5',
        paddingVertical: 22,
        fontSize: typography.size.sm,
    },
});
