import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { getRaceDriverDetail } from '../../../../backend/service/openf1Service';
import type { Lap, Overtake, RaceInsights, SessionDriverData, Stint } from '../../../../backend/types';
import RaceStatsSection from "../../../component/race/RaceStatsSection";
import RaceStintCard from '../../../component/race/RaceStintCard';
import TyreCompoundBadge from '../../../component/common/TyreCompoundBadge';
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
    driverData?: SessionDriverData | null;
    safetyCarLaps?: number[];
    driverOptions?: DriverOption[];
    overtakes?: Overtake[];
    raceInsights?: RaceInsights | null;
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
    const {
        driverNumber,
        sessionKey,
        driverData: driverDataParam,
        safetyCarLaps: safetyCarParam,
        driverOptions: driverOptionsParam,
        overtakes: overtakesParam,
        raceInsights: raceInsightsParam,
    } = route.params;
    const safetyCarLaps = safetyCarParam ?? EMPTY_SAFETY_CAR_LAPS;
    const driverOptions = driverOptionsParam ?? [];
    const overtakes = overtakesParam ?? EMPTY_OVERTAKES;
    const raceInsights = raceInsightsParam ?? null;

    const [selectedDriverNumber, setSelectedDriverNumber] = useState(driverNumber);

    const [state, setState] = useState<DriverState>({
        driverData: driverDataParam ?? null,
        loading: !driverDataParam,
        refreshing: false,
        error: null,
    });

    const fetchDriver = useCallback(
        async (targetDriver: number, isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading:
                    !isRefresh &&
                    (!prev.driverData || prev.driverData.driverNumber !== targetDriver),
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const detail = await getRaceDriverDetail(sessionKey, targetDriver);
                setState({
                    driverData: detail,
                    loading: false,
                    refreshing: false,
                    error: detail ? null : 'Driver data not found for this session',
                });
            } catch (error) {
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
        if (driverDataParam && driverDataParam.driverNumber === driverNumber) {
            setState({
                driverData: driverDataParam,
                loading: false,
                refreshing: false,
                error: null,
            });
        }
    }, [driverDataParam, driverNumber]);

    useEffect(() => {
        fetchDriver(selectedDriverNumber);
    }, [selectedDriverNumber, fetchDriver]);

    useEffect(() => {
        setSelectedDriverNumber(driverNumber);
    }, [driverNumber]);

    const handleRefresh = useCallback(
        () => fetchDriver(selectedDriverNumber, true),
        [fetchDriver, selectedDriverNumber]
    );

    const handleSelectDriver = useCallback(
        (optionNumber: number) => {
            if (optionNumber === selectedDriverNumber) return;
            setSelectedDriverNumber(optionNumber);
        },
        [selectedDriverNumber]
    );

    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const driverData = state.driverData;
    const [stintsExpanded, setStintsExpanded] = useState(true);

    const sortedStints = useMemo(() => {
        if (!driverData) return [];
        return [...driverData.stints].sort((a, b) => a.lap_start - b.lap_start);
    }, [driverData]);

    const stintsWithLaps = useMemo(() => {
        if (!driverData) {
            return [];
        }
        return sortedStints.map(stint => {
            const lapsForStint = driverData.laps.filter(
                (lap: Lap) => lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
            );
            return { stint, laps: lapsForStint };
        });
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
                <ActivityIndicator size="large" color="#E10600" />
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
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            {driverOptions.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.driverSwitchScroll}
                    contentContainerStyle={styles.driverSwitchContent}
                >
                    {driverOptions.map(option => {
                        const isActive = option.driverNumber === selectedDriverNumber;
                        return (
                            <TouchableOpacity
                                key={option.driverNumber}
                                style={[
                                    styles.driverChip,
                                    isActive && [
                                        styles.driverChipActive,
                                        { borderColor: getTeamColorHex(option.teamColor) },
                                    ],
                                ]}
                                activeOpacity={0.85}
                                onPress={() => handleSelectDriver(option.driverNumber)}
                            >
                                <Text
                                    style={[
                                        styles.driverChipName,
                                        isActive && styles.driverChipNameActive,
                                    ]}
                                >
                                    {option.name}
                                </Text>
                                <Text
                                    style={[
                                        styles.driverChipNumber,
                                        isActive && styles.driverChipNumberActive,
                                    ]}
                                >
                                    #{option.driverNumber}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
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
                                        <View style={styles.strategyCompactInfoBlock}>
                                            <View style={styles.strategyStintPill}>
                                                <Text style={styles.strategyStintPillText}>
                                                    Stint {summary.stintNumber}
                                                </Text>
                                            </View>
                                            <Text style={styles.strategyCompactLaps}>
                                                L{summary.lapStart} - L{summary.lapEnd}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.strategyCompactTyreState,
                                                    summary.isNewTyre
                                                        ? styles.strategyCompactTyreStateNew
                                                        : styles.strategyCompactTyreStateUsed,
                                                ]}
                                            >
                                                {summary.isNewTyre ? 'New tyre' : 'Used tyre'}
                                            </Text>
                                        </View>
                                        <TyreCompoundBadge
                                            compound={summary.compoundCode}
                                            size={38}
                                            style={styles.strategyCompoundBadge}
                                        />
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
                                <RaceStintCard
                                    key={stint.stint_number}
                                    stint={stint}
                                    laps={laps}
                                    showDivider={index < stintsWithLaps.length - 1}
                                    safetyCarLapSet={safetyCarLapSet}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E1E4EF',
    shadowColor: '#0F1325',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F7' },
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
    loadingText: { marginTop: 12, fontSize: 16, color: '#333' },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E10600', marginBottom: 8 },
    errorMessage: { fontSize: 16, color: '#333', textAlign: 'center' },
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
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: '800',
        marginTop: 8,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.85)',
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
        fontSize: 18,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    strategyCard: {
        ...CARD_BASE,
        marginTop: 20,
        marginHorizontal: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    strategyHeader: {
        marginBottom: 10,
    },
    strategyRowContent: {
        paddingVertical: 4,
    },
    strategyCompactCard: {
        width: 134,
        marginRight: 8,
    },
    strategyCompactCardLast: {
        marginRight: 0,
    },
    strategyCompactTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8F9FC',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#DFE3EE',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 10,
        minHeight: 84,
    },
    strategyCompactInfoBlock: {
        flex: 1,
        paddingRight: 6,
    },
    strategyStintPill: {
        backgroundColor: '#ECEFF9',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    strategyStintPillText: {
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: '#5D647E',
        fontWeight: '600',
    },
    strategyCompoundBadge: {
        marginRight: -1,
    },
    strategyCompactLaps: {
        marginTop: 8,
        fontSize: 11,
        color: '#6D738C',
        fontWeight: '700',
    },
    strategyCompactTyreState: {
        marginTop: 4,
        fontSize: 11,
        fontWeight: '700',
    },
    strategyCompactTyreStateNew: {
        color: '#1F8A4D',
    },
    strategyCompactTyreStateUsed: {
        color: '#6A6F87',
    },
    insightCard: {
        ...CARD_BASE,
        marginTop: 20,
        marginHorizontal: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    insightHeader: {
        marginBottom: 10,
    },
    insightMetricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    insightMetric: {
        width: '50%',
        paddingHorizontal: 4,
        marginTop: 8,
    },
    insightMetricLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#717791',
        fontWeight: '700',
    },
    insightMetricValue: {
        marginTop: 4,
        fontSize: 22,
        fontWeight: '800',
        color: '#15151E',
    },
    insightMetricMeta: {
        marginTop: 2,
        fontSize: 12,
        color: '#666C85',
    },
    metricFocusCard: {
        ...CARD_BASE,
        marginTop: 10,
        marginHorizontal: 16,
        paddingVertical: 16,
        paddingHorizontal: 14,
    },
    metricFocusRow: {
        flexDirection: 'row',
        marginHorizontal: -4,
    },
    metricFocusTile: {
        flex: 1,
        paddingHorizontal: 4,
    },
    metricFocusLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        color: '#717791',
        fontWeight: '700',
    },
    metricFocusValue: {
        marginTop: 4,
        fontSize: 22,
        fontWeight: '800',
        color: '#15151E',
    },
    insightExplainText: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
        color: '#656B84',
    },
    section: {
        ...CARD_BASE,
        marginTop: 20,
        marginHorizontal: 16,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    sectionSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: '#7C7C85',
    },
    sectionToggle: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#EFF0F7',
    },
    sectionToggleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4D5166',
    },
    sectionBody: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});
