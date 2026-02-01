import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getRaceDriverDetail } from '../../../../backend/service/openf1Service';
import { Lap, SessionDriverData, Stint } from '../../../../backend/types';
import RaceStatsSection from "../../../component/driver/RaceStatsSection";
import { formatLapTime } from '../../../../shared/time';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
    driverData?: SessionDriverData | null;
    safetyCarLaps?: number[];
};

const EMPTY_SAFETY_CAR_LAPS: number[] = [];

interface DriverState {
    driverData: SessionDriverData | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const getTeamColorHex = (teamColor?: string | null): string => {
    if (!teamColor || !teamColor.trim()) {
        return '#15151E';
    }
    return teamColor.startsWith('#') ? teamColor : `#${teamColor}`;
};

const getDriverInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (!parts.length) {
        return '?';
    }
    return parts
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2) || '?';
};

export default function DriverOverviewScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        sessionKey,
        driverData: driverDataParam,
        safetyCarLaps: safetyCarParam,
    } = route.params;
    const safetyCarLaps = safetyCarParam ?? EMPTY_SAFETY_CAR_LAPS;

    const [state, setState] = useState<DriverState>({
        driverData: driverDataParam ?? null,
        loading: !driverDataParam,
        refreshing: false,
        error: null,
    });

    const fetchDriver = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh && !prev.driverData,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const detail = await getRaceDriverDetail(sessionKey, driverNumber);
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
        [driverNumber, sessionKey]
    );

    useEffect(() => {
        if (driverDataParam) {
            setState(prev => ({
                ...prev,
                driverData: driverDataParam,
                loading: false,
                error: null,
            }));
        }
    }, [driverDataParam]);

    useEffect(() => {
        if (!driverDataParam) {
            fetchDriver();
        }
    }, [driverDataParam, fetchDriver]);

    const handleRefresh = useCallback(() => fetchDriver(true), [fetchDriver]);

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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: headerColor }]}>
                <View style={styles.headerContent}>
                    <View style={styles.avatarContainer}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>
                                {getDriverInitials(driverInfo.name)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.headerInfoTop}>
                            <Text style={styles.name}>{driverInfo.name}</Text>
                            <Text style={styles.number}>#{driverInfo.number}</Text>
                        </View>
                        <Text style={styles.team}>{driverInfo.team}</Text>
                    </View>
                </View>
            </View>

            {/* Race Stats Section - Now using RaceStatsSection component */}
            <RaceStatsSection
                raceResult={driverData.sessionResult}
                lapCount={driverData.laps.length}
                stintCount={driverData.stints.length}
                laps={driverData.laps}
                stints={driverData.stints}
                safetyCarLapSet={safetyCarLapSet}
            />

            {/* Lap Timeline */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lap Timeline</Text>
                {driverData.laps.length > 0 ? (
                    <View style={styles.lapTable}>
                        <View style={[styles.lapRow, styles.lapHeaderRow]}>
                            <Text style={[styles.lapCell, styles.headerText]}>Lap</Text>
                            <Text style={[styles.compoundHeaderCell, styles.headerText]}>
                                Compound
                            </Text>
                            <Text style={[styles.timeCell, styles.headerText]}>Time</Text>
                            <Text style={[styles.noteHeaderCell, styles.headerText]}>Note</Text>
                        </View>
                        {lapRows.map(({ lap, compound, isPitOut, isPitIn, isSafetyCar }) => (
                            <View
                                key={lap.lap_number}
                                style={[
                                    styles.lapRow,
                                    isSafetyCar && styles.safetyCarRow,
                                ]}
                            >
                                <Text style={styles.lapCell}>#{lap.lap_number}</Text>
                                <View style={styles.compoundCell}>
                                    <View
                                        style={[
                                            styles.compoundCircle,
                                            { backgroundColor: getCompoundColor(compound) }
                                        ]}
                                    >
                                        <Text style={styles.compoundLetter}>
                                            {getCompoundLetter(compound)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.timeCell}>
                                    {formatLapTime(lap.lap_duration)}
                                </Text>
                                <View style={styles.noteCell}>
                                    {isSafetyCar && (
                                        <View style={[styles.badge, styles.safetyCarBadge]}>
                                            <Text style={[styles.badgeText, styles.safetyCarText]}>
                                                SC
                                            </Text>
                                        </View>
                                    )}
                                    {isPitOut && (
                                        <View style={[styles.badge, styles.pitOutBadge]}>
                                            <Text style={[styles.badgeText, styles.pitOutText]}>
                                                Pit Out
                                            </Text>
                                        </View>
                                    )}
                                    {isPitIn && (
                                        <View style={[styles.badge, styles.pitInBadge]}>
                                            <Text style={[styles.badgeText, styles.pitInText]}>
                                                Pit In
                                            </Text>
                                        </View>
                                    )}
                                    {!isSafetyCar && !isPitOut && !isPitIn && (
                                        <Text style={styles.noBadge}>-</Text>
                                    )}
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

const getCompoundColor = (compound: string): string => {
    const compoundLower = compound.toLowerCase();
    switch (compoundLower) {
        case 'soft':
            return '#E10600';
        case 'medium':
            return '#d8b031';
        case 'hard':
            return '#9E9E9E';
        case 'intermediate':
            return '#4CAF50';
        case 'wet':
            return '#2196F3';
        default:
            return '#666';
    }
};

const getCompoundLetter = (compound: string): string => {
    const compoundLower = compound.toLowerCase();
    switch (compoundLower) {
        case 'soft':
            return 'S';
        case 'medium':
            return 'M';
        case 'hard':
            return 'H';
        case 'intermediate':
            return 'I';
        case 'wet':
            return 'W';
        default:
            return compoundLower.charAt(0).toUpperCase();
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#333' },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E10600', marginBottom: 8 },
    errorMessage: { fontSize: 16, color: '#333', textAlign: 'center' },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.2)',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 4,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitials: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 16,
    },
    headerInfoTop: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    name: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 0,
    },
    team: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
    },
    number: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFF',
    },

    section: {
        marginTop: 16,
        marginHorizontal: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
    },
    lapTable: {
        borderWidth: 1,
        borderColor: '#F0F0F0',
        borderRadius: 10,
        overflow: 'hidden',
    },
    lapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7F7F7',
    },
    lapHeaderRow: {
        backgroundColor: '#FAFAFA',
    },
    lapCell: {
        width: 70,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    compoundCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeCell: {
        width: 90,
        fontSize: 14,
        fontWeight: '600',
        color: '#E10600',
        textAlign: 'right',
    },
    noteCell: {
        flex: 1,
        minWidth: 90,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
    },
    compoundHeaderCell: {
        flex: 1,
        fontWeight: '600',
        textAlign: 'center',
    },
    noteHeaderCell: {
        flex: 1,
        minWidth: 70,
        textAlign: 'right',
    },
    compoundCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compoundLetter: {
        color: '#FFF',
        fontWeight: '700',
    },
    headerText: {
        fontSize: 11,
        textTransform: 'uppercase',
        color: '#888',
        letterSpacing: 0.8,
        fontWeight: '700',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    pitOutBadge: {
        backgroundColor: '#FFE4E1',
    },
    pitOutText: {
        color: '#C62828',
    },
    pitInBadge: {
        backgroundColor: '#E3F2FD',
    },
    pitInText: {
        color: '#1565C0',
    },
    safetyCarBadge: {
        backgroundColor: '#FFF3CD',
        borderWidth: 1,
        borderColor: '#FFEE58',
    },
    safetyCarText: {
        color: '#8D6E00',
    },
    noBadge: {
        fontSize: 13,
        color: '#999',
    },
    safetyCarRow: {
        backgroundColor: '#FFF8DC',
        borderColor: '#FFE082',
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});
