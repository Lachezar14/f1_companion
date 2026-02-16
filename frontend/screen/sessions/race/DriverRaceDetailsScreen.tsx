import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Image,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getRaceDriverDetail, getRaceSessionDetail } from '../../../../backend/service/openf1Service';
import type { Overtake, RaceSessionDetail, SessionDriverData } from '../../../../backend/types';
import RaceStatsSection from "../../../component/race/RaceStatsSection";
import StintCard from '../../../component/common/StintCard';
import TyreCompoundBadge from '../../../component/common/TyreCompoundBadge';
import { groupLapsByStints } from '../../../../utils/lap';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import {
    getTeamColorHex,
    getDriverInitials,
    formatSessionGap,
    formatSessionResult,
    getResultStatusLabel,
} from '../../../../utils/driver';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
};

type DriverOption = {
    driverNumber: number;
    name: string;
    team: string;
    teamColor?: string | null;
};

const EMPTY_SAFETY_CAR_LAPS: number[] = [];
const EMPTY_OVERTAKES: Overtake[] = [];

interface DriverState {
    driverData: SessionDriverData | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

export default function DriverOverviewScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { driverNumber, sessionKey } = route.params;

    const [selectedDriverNumber, setSelectedDriverNumber] = useState(driverNumber);
    const [isDriverListOpen, setIsDriverListOpen] = useState(false);

    const loadRaceContext = useCallback(async (): Promise<RaceSessionDetail> => {
        return getRaceSessionDetail(sessionKey);
    }, [sessionKey]);

    const {
        data: raceContext,
        refreshing: raceContextRefreshing,
        refresh: refreshRaceContext,
    } = useServiceRequest<RaceSessionDetail>(loadRaceContext, [loadRaceContext]);

    const safetyCarLaps = raceContext?.raceControlSummary.safetyCarLaps ?? EMPTY_SAFETY_CAR_LAPS;
    const raceInsights = raceContext?.insights ?? null;
    const overtakes = raceContext?.overtakes ?? EMPTY_OVERTAKES;
    const driverOptions = useMemo<DriverOption[]>(() => {
        if (!raceContext) return [];
        const map = new Map<number, DriverOption>();
        raceContext.drivers.forEach(entry => {
            map.set(entry.driverNumber, {
                driverNumber: entry.driverNumber,
                name: entry.driver.name,
                team: entry.driver.team,
                teamColor: entry.driver.teamColor,
            });
        });

        if (!map.size) return [];
        if (!raceContext.classification.length) {
            return Array.from(map.values());
        }

        const ordered: DriverOption[] = [];
        raceContext.classification.forEach(row => {
            const option = map.get(row.driverNumber);
            if (option) {
                ordered.push(option);
                map.delete(row.driverNumber);
            }
        });
        map.forEach(option => ordered.push(option));
        return ordered;
    }, [raceContext]);

    const [state, setState] = useState<DriverState>({
        driverData: null,
        loading: true,
        refreshing: false,
        error: null,
    });
    const requestIdRef = useRef(0);

    const fetchDriver = useCallback(
        async (targetDriver: number, isRefresh = false) => {
            const requestId = ++requestIdRef.current;
            setState(prev => ({
                ...prev,
                loading: !isRefresh && !prev.driverData,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const detail = await getRaceDriverDetail(sessionKey, targetDriver);
                if (requestId !== requestIdRef.current) {
                    return;
                }
                setState({
                    driverData: detail,
                    loading: false,
                    refreshing: false,
                    error: detail ? null : 'Driver data not found for this session',
                });
                if (detail?.driverNumber === targetDriver) {
                    setSelectedDriverNumber(targetDriver);
                }
            } catch (error) {
                if (requestId !== requestIdRef.current) {
                    return;
                }
                setState({
                    driverData: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load driver data',
                });
            }
        },
        [sessionKey]
    );

    useEffect(() => {
        if (state.driverData?.driverNumber === selectedDriverNumber) {
            return;
        }
        fetchDriver(selectedDriverNumber);
    }, [selectedDriverNumber, fetchDriver, state.driverData?.driverNumber]);

    const handleRefresh = useCallback(async () => {
        await Promise.all([
            fetchDriver(selectedDriverNumber, true),
            refreshRaceContext(),
        ]);
    }, [fetchDriver, refreshRaceContext, selectedDriverNumber]);

    const handleSelectDriver = useCallback(
        (optionNumber: number) => {
            if (optionNumber === selectedDriverNumber) {
                setIsDriverListOpen(false);
                return;
            }
            setSelectedDriverNumber(optionNumber);
            setIsDriverListOpen(false);
        },
        [selectedDriverNumber]
    );

    const selectedDriverOption = useMemo(() => {
        return (
            driverOptions.find(option => option.driverNumber === selectedDriverNumber) ?? null
        );
    }, [driverOptions, selectedDriverNumber]);

    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const driverData = state.driverData;
    const [stintsExpanded, setStintsExpanded] = useState(true);
    const pitInLapSet = useMemo(() => {
        if (!driverData) return new Set<number>();
        return new Set(
            driverData.laps
                .filter(lap => lap.is_pit_out_lap)
                .map(lap => lap.lap_number - 1)
                .filter(lapNumber => lapNumber > 0)
        );
    }, [driverData]);

    const sortedStints = useMemo(() => {
        if (!driverData) return [];
        return [...driverData.stints].sort((a, b) => a.lap_start - b.lap_start);
    }, [driverData]);

    const stintsWithLaps = useMemo(() => {
        if (!driverData) {
            return [];
        }
        return groupLapsByStints(driverData.laps, sortedStints);
    }, [driverData, sortedStints]);

    const strategySummary = useMemo(() => {
        return sortedStints.map(stint => ({
            stintNumber: stint.stint_number,
            lapStart: stint.lap_start,
            lapEnd: stint.lap_end,
            compoundCode: stint.compound,
            isNewTyre: !stint.tyre_age_at_start || stint.tyre_age_at_start <= 0,
        }));
    }, [sortedStints]);

    const overtakeInsight = useMemo(() => {
        const fromLeaderboard =
            raceInsights?.overtakeLeaderboard.drivers.find(
                entry => entry.driverNumber === selectedDriverNumber
            ) ?? null;
        if (fromLeaderboard) {
            return {
                made: fromLeaderboard.made,
                suffered: fromLeaderboard.suffered,
                net: fromLeaderboard.net,
            };
        }

        if (!overtakes.length) {
            return {
                made: 0,
                suffered: 0,
                net: 0,
            };
        }

        let made = 0;
        let suffered = 0;
        overtakes.forEach(entry => {
            if (entry.overtakingDriverNumber === selectedDriverNumber) {
                made += 1;
            }
            if (entry.overtakenDriverNumber === selectedDriverNumber) {
                suffered += 1;
            }
        });

        return {
            made,
            suffered,
            net: made - suffered,
        };
    }, [overtakes, raceInsights, selectedDriverNumber]);

    const positionGainInsight = useMemo(() => {
        return (
            raceInsights?.positionChanges.drivers.find(
                entry => entry.driverNumber === selectedDriverNumber
            ) ?? null
        );
    }, [raceInsights, selectedDriverNumber]);

    const paceConsistencyInsight = useMemo(() => {
        return (
            raceInsights?.paceConsistency.drivers.find(
                entry => entry.driverNumber === selectedDriverNumber
            ) ?? null
        );
    }, [raceInsights, selectedDriverNumber]);

    const tyreDegradationSummary = useMemo(() => {
        const stints = raceInsights?.tyreDegradation.stints.filter(
            entry => entry.driverNumber === selectedDriverNumber
        ) ?? [];
        if (!stints.length) {
            return null;
        }

        const weightedDelta = stints.reduce(
            (acc, entry) => {
                if (typeof entry.deltaFirstToLast !== 'number' || Number.isNaN(entry.deltaFirstToLast)) {
                    return acc;
                }
                return {
                    total: acc.total + entry.deltaFirstToLast * entry.lapCount,
                    laps: acc.laps + entry.lapCount,
                };
            },
            { total: 0, laps: 0 }
        );

        const weightedSlope = stints.reduce(
            (acc, entry) => {
                if (typeof entry.slope !== 'number' || Number.isNaN(entry.slope)) {
                    return acc;
                }
                return {
                    total: acc.total + entry.slope * entry.lapCount,
                    laps: acc.laps + entry.lapCount,
                };
            },
            { total: 0, laps: 0 }
        );

        const averageDelta =
            weightedDelta.laps > 0 ? weightedDelta.total / weightedDelta.laps : null;
        const averageSlope =
            weightedSlope.laps > 0 ? weightedSlope.total / weightedSlope.laps : null;

        return {
            stintCount: stints.length,
            lapCount: stints.reduce((sum, entry) => sum + entry.lapCount, 0),
            averageDelta,
            averageSlope,
        };
    }, [raceInsights, selectedDriverNumber]);

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    if (!driverData) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Driver Not Found</Text>
                <Text style={styles.errorMessage}>No data available for this driver.</Text>
            </View>
        );
    }

    const driverInfo = driverData.driver;
    const headerColor = getTeamColorHex(driverInfo.teamColor);
    const driverImageSource = driverInfo.headshotUrl
        ? { uri: driverInfo.headshotUrl }
        : null;
    const heroStats = [
        { label: 'Result', value: formatSessionResult(driverData.sessionResult) },
        { label: 'Grid', value: driverData.startingPosition ?? '—' },
        { label: 'Gap', value: formatSessionGap(driverData.sessionResult?.gap_to_leader ?? null) }
    ];
    const resultStatus = getResultStatusLabel(driverData.sessionResult);
    const formatSeconds = (value: number | null | undefined) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '—';
        return `${value.toFixed(3)}s`;
    };
    const formatSignedSeconds = (value: number | null | undefined) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '—';
        const prefix = value > 0 ? '+' : '';
        return `${prefix}${value.toFixed(3)}s`;
    };
    const positionGainValue = positionGainInsight
        ? `${positionGainInsight.gain > 0 ? '+' : ''}${positionGainInsight.gain}`
        : '—';
    const positionGainMeta = positionGainInsight
        ? `Start P${positionGainInsight.start} -> Finish P${positionGainInsight.finish}`
        : 'No position change data';
    const paceConsistencyValue = paceConsistencyInsight
        ? `${paceConsistencyInsight.coefficientOfVariation.toFixed(2)}%`
        : '—';
    const paceConsistencyStdDev = formatSeconds(paceConsistencyInsight?.standardDeviation ?? null);
    const paceConsistencyLapCount = paceConsistencyInsight
        ? `${paceConsistencyInsight.lapCount}`
        : '—';
    const tyreDegradationScore = formatSignedSeconds(tyreDegradationSummary?.averageDelta ?? null);
    const tyreDegradationSlope = formatSignedSeconds(tyreDegradationSummary?.averageSlope ?? null);
    const tyreDegradationSample = tyreDegradationSummary
        ? `${tyreDegradationSummary.stintCount}/${tyreDegradationSummary.lapCount}`
        : '—';
    const overtakeNetValue =
        overtakeInsight.net > 0 ? `+${overtakeInsight.net}` : `${overtakeInsight.net}`;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing || raceContextRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={semanticColors.danger}
                />
            }
        >
            {driverOptions.length > 0 && (
                <View style={styles.driverSelectorContainer}>
                    <TouchableOpacity
                        style={[
                            styles.driverSelectorField,
                            isDriverListOpen && styles.driverSelectorFieldOpen,
                        ]}
                        activeOpacity={0.88}
                        onPress={() => setIsDriverListOpen(prev => !prev)}
                    >
                        <View style={styles.driverSelectorLabelWrap}>
                            <Text style={styles.driverSelectorName}>
                                {selectedDriverOption?.name ?? `Driver #${selectedDriverNumber}`}
                            </Text>
                            <Text style={styles.driverSelectorMeta}>
                                {selectedDriverOption?.team ?? 'Choose driver'}
                            </Text>
                        </View>
                        <Text style={styles.driverSelectorCaret}>
                            {isDriverListOpen ? '▲' : '▼'}
                        </Text>
                    </TouchableOpacity>
                    {isDriverListOpen && (
                        <ScrollView
                            style={styles.driverSelectorList}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                        >
                            {driverOptions.map(option => {
                                const isActive = option.driverNumber === selectedDriverNumber;
                                return (
                                    <TouchableOpacity
                                        key={option.driverNumber}
                                        style={[
                                            styles.driverOptionRow,
                                            isActive && styles.driverOptionRowActive,
                                        ]}
                                        activeOpacity={0.85}
                                        onPress={() => handleSelectDriver(option.driverNumber)}
                                    >
                                        <View style={styles.driverOptionInfo}>
                                            <Text
                                                style={[
                                                    styles.driverOptionName,
                                                    isActive && styles.driverOptionNameActive,
                                                ]}
                                            >
                                                {option.name}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.driverOptionMeta,
                                                    isActive && styles.driverOptionMetaActive,
                                                ]}
                                            >
                                                {option.team}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.driverOptionNumber,
                                                isActive && styles.driverOptionNumberActive,
                                            ]}
                                        >
                                            #{option.driverNumber}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            )}
            <View style={[styles.heroCard, { backgroundColor: headerColor }]}>
                <View style={styles.heroRow}>
                    <View style={styles.heroTextBlock}>
                        <Text style={styles.heroSubtitle}>Race Classification</Text>
                        <Text style={styles.heroName}>{driverInfo.name}</Text>
                        <Text style={styles.heroTeam}>{driverInfo.team}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>#{driverInfo.number}</Text>
                            </View>
                            <View style={[styles.heroChip, styles.heroChipMuted]}>
                                <Text style={[styles.heroChipText, styles.heroChipTextMuted]}>
                                    {resultStatus}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroAvatar}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.heroImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>
                                {getDriverInitials(driverInfo.name)}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.heroStatRow}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <RaceStatsSection
                raceResult={driverData.sessionResult}
                lapCount={driverData.laps.length}
                laps={driverData.laps}
                stints={driverData.stints}
                pitStops={driverData.pitStops ?? []}
                safetyCarLapSet={safetyCarLapSet}
            />

            <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                    <Text style={styles.sectionTitle}>Driver Race Insights</Text>
                    <Text style={styles.sectionSubtitle}>Overtakes and position change</Text>
                </View>
                <View style={styles.insightMetricGrid}>
                    <View style={styles.insightMetric}>
                        <Text style={styles.insightMetricLabel}>Overtake Net</Text>
                        <Text style={styles.insightMetricValue}>{overtakeNetValue}</Text>
                        <Text style={styles.insightMetricMeta}>
                            Made {overtakeInsight.made} • Suffered {overtakeInsight.suffered}
                        </Text>
                    </View>
                    <View style={styles.insightMetric}>
                        <Text style={styles.insightMetricLabel}>Position Gain</Text>
                        <Text style={styles.insightMetricValue}>{positionGainValue}</Text>
                        <Text style={styles.insightMetricMeta}>{positionGainMeta}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.metricFocusCard}>
                <View style={styles.insightHeader}>
                    <Text style={styles.sectionTitle}>Pace Consistency</Text>
                    <Text style={styles.sectionSubtitle}>Lower CV means more consistent times</Text>
                </View>
                <View style={styles.metricFocusRow}>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>CV</Text>
                        <Text style={styles.metricFocusValue}>{paceConsistencyValue}</Text>
                    </View>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>σ (seconds)</Text>
                        <Text style={styles.metricFocusValue}>{paceConsistencyStdDev}</Text>
                    </View>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>Valid Laps</Text>
                        <Text style={styles.metricFocusValue}>{paceConsistencyLapCount}</Text>
                    </View>
                </View>
                <Text style={styles.insightExplainText}>
                    Uses valid race laps only (pit-out and safety car laps are excluded). Standard
                    deviation (σ) and coefficient of variation (CV = σ / average lap) are computed.
                </Text>
            </View>

            <View style={styles.metricFocusCard}>
                <View style={styles.insightHeader}>
                    <Text style={styles.sectionTitle}>Tyre Degradation</Text>
                    <Text style={styles.sectionSubtitle}>Bigger delta means tyres degrading more</Text>
                </View>
                <View style={styles.metricFocusRow}>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>Delta</Text>
                        <Text style={styles.metricFocusValue}>{tyreDegradationScore}</Text>
                    </View>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>Slope</Text>
                        <Text style={styles.metricFocusValue}>{tyreDegradationSlope}</Text>
                    </View>
                    <View style={styles.metricFocusTile}>
                        <Text style={styles.metricFocusLabel}>Stints/Laps</Text>
                        <Text style={styles.metricFocusValue}>{tyreDegradationSample}</Text>
                    </View>
                </View>
                <Text style={styles.insightExplainText}>
                    Score is the lap-count-weighted average of each stint's first-vs-last lap delta.
                    Slope is weighted seconds-per-lap trend.
                </Text>
            </View>

            {strategySummary.length ? (
                <View style={styles.strategyCard}>
                    <View style={styles.strategyHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Strategy Overview</Text>
                            <Text style={styles.sectionSubtitle}>Stint data summary including laps and tire status.</Text>
                        </View>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.strategyRowContent}
                    >
                        {strategySummary.map((summary, index) => {
                            return (
                                <View
                                    key={summary.stintNumber}
                                    style={[
                                        styles.strategyCompactCard,
                                        index === strategySummary.length - 1 && styles.strategyCompactCardLast,
                                    ]}
                                >
                                    <View style={styles.strategyCompactTopRow}>
                                        <TyreCompoundBadge
                                            compound={summary.compoundCode}
                                            size={38}
                                            style={styles.strategyCompoundBadge}
                                        />
                                        <View style={styles.strategyCompactInfoBlock}>
                                            <Text style={styles.strategyStintLabel}>
                                                STINT {summary.stintNumber}
                                            </Text>
                                            <Text style={styles.strategyCompactLaps}>
                                                L{summary.lapStart} - L{summary.lapEnd}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.strategyTyreChip,
                                                    summary.isNewTyre
                                                        ? styles.strategyTyreChipNew
                                                        : styles.strategyTyreChipUsed,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.strategyTyreChipText,
                                                        summary.isNewTyre
                                                            ? styles.strategyTyreChipTextNew
                                                            : styles.strategyTyreChipTextUsed,
                                                    ]}
                                                >
                                                    {summary.isNewTyre ? 'New tyre' : 'Used tyre'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            ) : null}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Stints & Laps</Text>
                        <Text style={styles.sectionSubtitle}>Complete overview of driver's race laps</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.sectionToggle}
                        onPress={() => setStintsExpanded(prev => !prev)}
                    >
                        <Text style={styles.sectionToggleText}>
                            {stintsExpanded ? 'Hide' : 'Show'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {stintsExpanded ? (
                    <View style={styles.sectionBody}>
                        {stintsWithLaps.length ? (
                            stintsWithLaps.map(({ stint, laps }, index) => (
                                <StintCard
                                    key={stint.stint_number}
                                    stint={stint}
                                    laps={laps}
                                    showDivider={index < stintsWithLaps.length - 1}
                                    safetyCarLapSet={safetyCarLapSet}
                                    pitInLapSet={pitInLapSet}
                                />
                            ))
                        ) : (
                            <Text style={styles.noData}>No stints recorded for this driver</Text>
                        )}
                    </View>
                ) : null}
            </View>
        </ScrollView>
    );
}

const CARD_BASE = {
    backgroundColor: semanticColors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: '#E1E4EF',
    shadowColor: '#0F1325',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: semanticColors.background },
    driverSelectorContainer: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    driverSelectorField: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#D9DEEC',
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    driverSelectorFieldOpen: {
        borderColor: '#BFC6DF',
        borderBottomLeftRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
    },
    driverSelectorLabelWrap: {
        flex: 1,
        paddingRight: spacing.md,
    },
    driverSelectorName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    driverSelectorMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    driverSelectorCaret: {
        fontSize: typography.size.sm,
        color: semanticColors.textSecondary,
        fontWeight: typography.weight.bold,
    },
    driverSelectorList: {
        maxHeight: 280,
        marginTop: spacing.xxs,
        borderWidth: 1,
        borderColor: '#D9DEEC',
        borderRadius: radius.lg,
        backgroundColor: semanticColors.surface,
    },
    driverOptionRow: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E6E9F4',
    },
    driverOptionRowActive: {
        backgroundColor: '#F5F6FB',
    },
    driverOptionInfo: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    driverOptionName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    driverOptionNameActive: {
        color: semanticColors.textPrimary,
    },
    driverOptionMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    driverOptionMetaActive: {
        color: semanticColors.textSecondary,
    },
    driverOptionNumber: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#6D7390',
    },
    driverOptionNumberActive: {
        color: semanticColors.textPrimary,
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
    loadingText: { marginTop: spacing.sm, fontSize: typography.size.lg, color: semanticColors.textSecondary },
    errorTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: semanticColors.danger, marginBottom: spacing.xs },
    errorMessage: { fontSize: typography.size.lg, color: semanticColors.textSecondary, textAlign: 'center' },
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
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        color: semanticColors.surface,
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.heavy,
        marginTop: spacing.xs,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.85)',
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
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.sm,
        marginTop: spacing.xxs,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    strategyCard: {
        ...CARD_BASE,
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    strategyHeader: {
        marginBottom: spacing.sm,
    },
    strategyRowContent: {
        paddingVertical: spacing.xxs,
    },
    strategyCompactCard: {
        width: 170,
        marginRight: spacing.xs,
    },
    strategyCompactCardLast: {
        marginRight: 0,
    },
    strategyCompactTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: semanticColors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#DFE3EE',
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        minHeight: 96,
    },
    strategyCompactInfoBlock: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    strategyStintLabel: {
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
        fontWeight: typography.weight.bold,
    },
    strategyCompoundBadge: {
        marginTop: spacing.xxs,
    },
    strategyCompactLaps: {
        marginTop: 6,
        fontSize: typography.size.base,
        color: semanticColors.textPrimary,
        fontWeight: typography.weight.bold,
    },
    strategyTyreChip: {
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    strategyTyreChipNew: {
        backgroundColor: 'rgba(31,138,77,0.12)',
        borderColor: 'rgba(31,138,77,0.35)',
    },
    strategyTyreChipUsed: {
        backgroundColor: 'rgba(106,111,135,0.12)',
        borderColor: 'rgba(106,111,135,0.35)',
    },
    strategyTyreChipText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: 0.3,
    },
    strategyTyreChipTextNew: {
        color: semanticColors.success,
    },
    strategyTyreChipTextUsed: {
        color: '#6A6F87',
    },
    insightCard: {
        ...CARD_BASE,
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    insightHeader: {
        marginBottom: spacing.sm,
    },
    insightMetricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    insightMetric: {
        width: '50%',
        paddingHorizontal: spacing.xxs,
        marginTop: spacing.xs,
    },
    insightMetricLabel: {
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#717791',
        fontWeight: typography.weight.bold,
    },
    insightMetricValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.heavy,
        color: semanticColors.textPrimary,
    },
    insightMetricMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: '#666C85',
    },
    metricFocusCard: {
        ...CARD_BASE,
        marginTop: spacing.sm,
        marginHorizontal: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    metricFocusRow: {
        flexDirection: 'row',
        marginHorizontal: -4,
    },
    metricFocusTile: {
        flex: 1,
        paddingHorizontal: spacing.xxs,
    },
    metricFocusLabel: {
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        color: '#717791',
        fontWeight: typography.weight.bold,
    },
    metricFocusValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.heavy,
        color: semanticColors.textPrimary,
    },
    insightExplainText: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        lineHeight: 18,
        color: '#656B84',
    },
    section: {
        ...CARD_BASE,
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
    },
    sectionHeader: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sectionSubtitle: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    sectionToggle: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: '#EFF0F7',
    },
    sectionToggleText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textSecondary,
    },
    sectionBody: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    noData: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        fontStyle: 'italic',
        paddingVertical: spacing.lg,
        textAlign: 'center',
    },
});
