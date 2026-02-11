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
import type { Lap, SessionDriverData, SessionResult, Stint } from '../../../../backend/types';
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
import { getCompoundName } from '../../../../utils/tyre';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
    driverData?: SessionDriverData | null;
    safetyCarLaps?: number[];
    driverOptions?: DriverOption[];
};

type DriverOption = {
    driverNumber: number;
    name: string;
    team: string;
    teamColor?: string | null;
};

const EMPTY_SAFETY_CAR_LAPS: number[] = [];

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
    } = route.params;
    const safetyCarLaps = safetyCarParam ?? EMPTY_SAFETY_CAR_LAPS;
    const driverOptions = driverOptionsParam ?? [];

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

    const [strategyExpanded, setStrategyExpanded] = useState(true);
    const strategySummary = useMemo(() => {
        return sortedStints.map(stint => ({
            stintNumber: stint.stint_number,
            lapRange: `Laps ${stint.lap_start} – ${stint.lap_end}`,
            compoundCode: stint.compound,
            isNewTyre: !stint.tyre_age_at_start || stint.tyre_age_at_start <= 0,
        }));
    }, [sortedStints]);

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
        { label: 'Gap', value: formatSessionGap(driverData.sessionResult?.gap_to_leader) }
    ];
    const resultStatus = getResultStatusLabel(driverData.sessionResult);

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

            {strategySummary.length ? (
                <View style={styles.strategyCard}>
                    <View style={styles.strategyHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Strategy Overview</Text>
                            <Text style={styles.sectionSubtitle}>Lap coverage & tyre freshness</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.sectionToggle}
                            onPress={() => setStrategyExpanded(prev => !prev)}
                        >
                            <Text style={styles.sectionToggleText}>
                                {strategyExpanded ? 'Hide' : 'Show'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {strategyExpanded ? (
                        <View style={styles.strategyListCard}>
                            {strategySummary.map((summary, index) => {
                                const compoundLabel = getCompoundName(summary.compoundCode);
                                return (
                                    <View
                                        key={summary.stintNumber}
                                        style={[
                                            styles.strategyListRow,
                                            index === strategySummary.length - 1 && styles.strategyListRowLast,
                                        ]}
                                    >
                                        <View style={styles.strategyListInfo}>
                                            <TyreCompoundBadge
                                                compound={summary.compoundCode}
                                                size={42}
                                                style={styles.strategyCompoundBadge}
                                            />
                                            <View>
                                                <Text style={styles.strategyStintLabel}>Stint {summary.stintNumber}</Text>
                                                <Text style={styles.strategyCompoundLabel}>{compoundLabel}</Text>
                                                <Text style={styles.strategyLapValue}>{summary.lapRange}</Text>
                                            </View>
                                        </View>
                                        <View
                                            style={[
                                                styles.strategyTyrePill,
                                                summary.isNewTyre
                                                    ? styles.strategyTyrePillNew
                                                    : styles.strategyTyrePillUsed,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.strategyTyreState,
                                                    summary.isNewTyre
                                                        ? styles.strategyTyreStateNew
                                                        : styles.strategyTyreStateUsed,
                                                ]}
                                            >
                                                {summary.isNewTyre ? 'New Tyre' : 'Used Tyre'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : null}
                </View>
            ) : null}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Stints & Laps</Text>
                        <Text style={styles.sectionSubtitle}>Tyre evolution with safety car markers</Text>
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
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    strategyHeader: {
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    strategyListCard: {
        marginTop: 16,
        backgroundColor: '#F8F9FC',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DFE3EE',
    },
    strategyListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#DDE1ED',
    },
    strategyListRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    strategyListInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    strategyCompoundBadge: {
        marginRight: 2,
    },
    strategyStintLabel: {
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: '#8B8FA8',
        fontWeight: '700',
    },
    strategyCompoundLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#15151E',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    strategyLapValue: {
        marginTop: 2,
        fontSize: 15,
        fontWeight: '600',
        color: '#15151E',
    },
    strategyTyrePill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E1E4EF',
        backgroundColor: '#FFF',
    },
    strategyTyrePillNew: {
        backgroundColor: 'rgba(31,138,77,0.12)',
        borderColor: 'rgba(31,138,77,0.4)',
    },
    strategyTyrePillUsed: {
        backgroundColor: 'rgba(106,111,135,0.12)',
        borderColor: 'rgba(106,111,135,0.4)',
    },
    strategyTyreState: {
        fontSize: 13,
        fontWeight: '700',
    },
    strategyTyreStateNew: {
        color: '#1F8A4D',
    },
    strategyTyreStateUsed: {
        color: '#6A6F87',
    },
    section: {
        ...CARD_BASE,
        marginTop: 20,
        marginHorizontal: 16,
    },
    sectionHeader: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    sectionSubtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#7C7C85',
    },
    sectionToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#EFF0F7',
    },
    sectionToggleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4D5166',
    },
    sectionBody: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});
