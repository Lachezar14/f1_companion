import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getPracticeDriverDetail } from '../../../../backend/service/openf1Service';
import PracticeStatsSection from '../../../component/driver/PracticeStatsSection';
import PracticeStintCard from '../../../component/driver/PracticeStintCard';
import type { Lap, SessionDriverData, SessionResult, Stint } from '../../../../backend/types';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
    driverData?: SessionDriverData | null;
};

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
    return (
        parts
            .map(part => part[0]?.toUpperCase() ?? '')
            .join('')
            .slice(0, 2) || '?'
    );
};

const formatGap = (gap: SessionResult['gap_to_leader']): string => {
    if (gap === null || gap === undefined) {
        return '—';
    }
    if (typeof gap === 'string') {
        return gap.toUpperCase();
    }
    if (typeof gap === 'number') {
        return `+${gap.toFixed(3)}s`;
    }
    if (Array.isArray(gap)) {
        const numericGap = gap.find(value => typeof value === 'number') as number | undefined;
        if (typeof numericGap === 'number') {
            return `+${numericGap.toFixed(3)}s`;
        }
    }
    return '—';
};

const formatResult = (result?: SessionResult | null): string => {
    if (!result) {
        return '—';
    }
    if (result.dsq) return 'DSQ';
    if (result.dnf) return 'DNF';
    if (result.dns) return 'DNS';
    if (result.position) return `P${result.position}`;
    return '—';
};

const getResultStatus = (result?: SessionResult | null): string => {
    if (!result) {
        return 'Practice Run';
    }
    if (result.dsq) return 'Disqualified';
    if (result.dnf) return 'Did Not Finish';
    if (result.dns) return 'Did Not Start';
    return 'Classified';
};

export default function DriverPracticeDetailsScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { driverNumber, sessionKey, driverData: driverDataParam } = route.params;

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
                const detail = await getPracticeDriverDetail(sessionKey, driverNumber);
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

    const driverData = state.driverData;

    const stintsWithLaps = useMemo(() => {
        if (!driverData) {
            return [];
        }

        return driverData.stints.map((stint: Stint) => {
            const lapsForStint = driverData.laps.filter(
                (lap: Lap) => lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
            );

            return {
                stint,
                laps: lapsForStint,
            };
        });
    }, [driverData]);

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

    const headerColor = getTeamColorHex(driverData.driver.teamColor);
    const driverImageSource = driverData.driver.headshotUrl
        ? { uri: driverData.driver.headshotUrl }
        : null;
    const sessionResult = driverData.sessionResult;
    const heroStats = [
        {
            label: 'Result',
            value: formatResult(sessionResult),
        },
        {
            label: 'Laps',
            value: sessionResult?.number_of_laps ?? driverData.laps.length,
        },
        {
            label: 'Gap',
            value: formatGap(sessionResult?.gap_to_leader),
        },
    ];

    const statusLabel = getResultStatus(sessionResult);

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
            <View style={[styles.heroCard, { backgroundColor: headerColor }]}>
                <View style={styles.heroRow}>
                    <View style={styles.heroTextBlock}>
                        <Text style={styles.heroSubtitle}>Free Practice</Text>
                        <Text style={styles.heroName}>{driverData.driver.name}</Text>
                        <Text style={styles.heroTeam}>{driverData.driver.team}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>#{driverData.driver.number}</Text>
                            </View>
                            <View style={[styles.heroChip, styles.heroChipMuted]}>
                                <Text style={[styles.heroChipText, styles.heroChipTextMuted]}>
                                    {statusLabel}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroAvatar}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.heroImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>
                                {getDriverInitials(driverData.driver.name)}
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

            <PracticeStatsSection
                lapCount={driverData.laps.length}
                stints={driverData.stints}
                laps={driverData.laps}
            />

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Stints & Laps</Text>
                    <Text style={styles.sectionSubtitle}>Tyre evolution and stint detail</Text>
                </View>
                {stintsWithLaps.length > 0 ? (
                    stintsWithLaps.map(({ stint, laps }) => (
                        <PracticeStintCard key={stint.stint_number} stint={stint} laps={laps} />
                    ))
                ) : (
                    <Text style={styles.noData}>No stints recorded for this session</Text>
                )}
            </View>
        </ScrollView>
    );
}

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
        fontSize: 16,
        color: '#333',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
    heroCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 28,
        shadowColor: '#000',
        shadowOpacity: 0.18,
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
        color: 'rgba(255,255,255,0.75)',
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
        backgroundColor: 'rgba(255,255,255,0.16)',
        marginRight: 10,
    },
    heroChipMuted: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroChipText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
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
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: 24,
        backgroundColor: 'rgba(0,0,0,0.18)',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 12,
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
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        letterSpacing: 0.7,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    section: {
        marginTop: 20,
        marginHorizontal: 16,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#7C7C85',
        marginTop: 4,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 16,
    },
});
