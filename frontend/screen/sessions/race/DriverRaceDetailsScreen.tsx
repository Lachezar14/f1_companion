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
import TyreCompoundBadge from '../../../component/common/TyreCompoundBadge';
import { formatLapTime } from '../../../../shared/time';
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

    const sortedStints = useMemo(() => {
        if (!driverData) return [];
        return [...driverData.stints].sort((a, b) => a.lap_start - b.lap_start);
    }, [driverData]);

    const lapRows = useMemo(() => {
        if (!driverData) return [];
        return driverData.laps.map((lap: Lap) => {
            const currentStint = sortedStints.find(
                (stint: Stint) =>
                    lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
            );
            const stintIndex = currentStint
                ? sortedStints.findIndex(s => s.stint_number === currentStint.stint_number)
                : -1;
            const hasNextStint = stintIndex > -1 && stintIndex < sortedStints.length - 1;
            const isPitIn =
                Boolean(currentStint) && hasNextStint && lap.lap_number === currentStint.lap_end;

            const compound = currentStint?.compound ?? 'Unknown';
            const isSafetyCar = safetyCarLapSet.has(lap.lap_number);

            return {
                lap,
                compound,
                isPitOut: lap.is_pit_out_lap,
                isPitIn,
                isSafetyCar,
            };
        });
    }, [driverData, sortedStints, safetyCarLapSet]);

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
        { label: 'Laps', value: driverData.sessionResult?.number_of_laps ?? driverData.laps.length },
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

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Lap Timeline</Text>
                    <Text style={styles.sectionSubtitle}>Tyres, pace and safety car notes</Text>
                </View>
                {driverData.laps.length > 0 ? (
                    <View style={styles.lapTable}>
                        <View style={[styles.lapRow, styles.lapHeaderRow]}>
                            <Text style={[styles.lapCell, styles.headerText]}>Lap</Text>
                            <Text style={[styles.compoundHeaderCell, styles.headerText]}>Tyre</Text>
                            <Text style={[styles.timeCell, styles.headerText]}>Time</Text>
                            <Text style={[styles.noteHeaderCell, styles.headerText]}>Notes</Text>
                        </View>
                        {lapRows.map(({ lap, compound, isPitOut, isSafetyCar }) => (
                            <View
                                key={lap.lap_number}
                                style={[
                                    styles.lapRow,
                                    isSafetyCar && styles.safetyCarRow,
                                ]}
                            >
                                <Text style={styles.lapCell}>#{lap.lap_number}</Text>
                                <View style={styles.compoundCell}>
                                    <TyreCompoundBadge
                                        compound={compound}
                                        size={38}
                                        style={styles.compoundBadge}
                                    />
                                </View>
                                <Text style={styles.timeCell}>
                                    {lap.lap_duration ? formatLapTime(lap.lap_duration) : '—'}
                                </Text>
                                <View style={styles.noteCell}>
                                    <View style={styles.noteCellContent}>
                                        {isSafetyCar && (
                                            <View style={[styles.badge, styles.safetyCarBadge]}>
                                                <Text style={[styles.badgeText, styles.safetyCarText]}>SC</Text>
                                            </View>
                                        )}
                                        {isPitOut && (
                                            <View style={[styles.badge, styles.pitOutBadge]}>
                                                <Text style={[styles.badgeText, styles.pitOutText]}>Pit Out</Text>
                                            </View>
                                        )}
                                        {!isSafetyCar && !isPitOut && (
                                            <Text style={styles.noBadge}>-</Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text style={styles.noData}>Lap times not available</Text>
                )}
            </View>
        </ScrollView>
    );
}

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
    section: {
        marginTop: 20,
        marginHorizontal: 16,
        backgroundColor: '#FFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: {
        padding: 20
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
    lapTable: {
        borderWidth: 1,
        borderColor: '#ECECF1',
        borderRadius: 10,
        overflow: 'hidden',
    },
    lapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F3F5',
    },
    lapHeaderRow: {
        backgroundColor: '#F6F6F9',
    },
    lapCell: {
        width: 70,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    compoundHeaderCell: {
        flex: 1,
        textAlign: 'center',
        fontWeight: '600',
    },
    compoundCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compoundBadge: {
        marginVertical: 2,
    },
    timeCell: {
        width: 90,
        fontSize: 14,
        fontWeight: '700',
        color: '#15151E',
        textAlign: 'right',
    },
    noteHeaderCell: {
        flex: 1,
        minWidth: 70,
        textAlign: 'right',
    },
    noteCell: {
        flex: 1,
        minWidth: 90,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    noteCellContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerText: {
        fontSize: 11,
        textTransform: 'uppercase',
        color: '#888',
        letterSpacing: 0.8,
        fontWeight: '700',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    pitOutBadge: {
        backgroundColor: 'rgba(225, 6, 0, 0.08)',
    },
    pitOutText: {
        color: '#B40012',
    },
    safetyCarBadge: {
        backgroundColor: 'rgba(255, 218, 103, 0.35)',
    },
    safetyCarText: {
        color: '#8D6E00',
    },
    safetyCarRow: {
        backgroundColor: '#FFF8DC',
    },
    noBadge: {
        fontSize: 13,
        color: '#999',
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});
