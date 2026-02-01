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
import { DriverRaceOverview, getDriverRaceOverview } from '../../backend/service/openf1Service';
import PracticeStatsSection from '../component/driver/PracticeStatsSection';
import PracticeStintCard from '../component/driver/PracticeStintCard';
import { Lap, Stint } from '../../backend/types';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
};

interface DriverState {
    data: DriverRaceOverview | null;
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

export default function DriverPracticeDetailsScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { driverNumber, sessionKey } = route.params;

    const [state, setState] = useState<DriverState>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    const fetchDriver = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const overview = await getDriverRaceOverview(sessionKey, driverNumber);

                if (!overview) {
                    setState({
                        data: null,
                        loading: false,
                        refreshing: false,
                        error: 'Driver data not found for this session',
                    });
                    return;
                }

                setState({
                    data: overview,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    data: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load driver data',
                });
            }
        },
        [driverNumber, sessionKey]
    );

    useEffect(() => {
        fetchDriver();
    }, [fetchDriver]);

    const handleRefresh = useCallback(() => fetchDriver(true), [fetchDriver]);

    const driverOverview = state.data;

    const stintsWithLaps = useMemo(() => {
        if (!driverOverview) {
            return [];
        }

        return driverOverview.stints.map((stint: Stint) => {
            const lapsForStint = driverOverview.laps.filter(
                (lap: Lap) => lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
            );

            return {
                stint,
                laps: lapsForStint,
            };
        });
    }, [driverOverview]);

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error || !driverOverview) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const headerColor = getTeamColorHex(driverOverview.driver.teamColor);
    const driverImageSource = driverOverview.driver.headshotUrl
        ? { uri: driverOverview.driver.headshotUrl }
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
            <View style={[styles.header, { backgroundColor: headerColor }]}>
                <View style={styles.headerContent}>
                    <View style={styles.avatarContainer}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>
                                {getDriverInitials(driverOverview.driver.name)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.headerInfoTop}>
                            <Text style={styles.name}>{driverOverview.driver.name}</Text>
                            <Text style={styles.number}>#{driverOverview.driver.number}</Text>
                        </View>
                        <Text style={styles.team}>{driverOverview.driver.team}</Text>
                    </View>
                </View>
            </View>

            <PracticeStatsSection
                lapCount={driverOverview.lap_count}
                stints={driverOverview.stints}
                laps={driverOverview.laps}
            />

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stints & Laps</Text>
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
        backgroundColor: '#F5F5F5',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F5F5F5',
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
        backgroundColor: 'rgba(255,255,255,0.35)',
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
        marginBottom: 4,
    },
    number: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
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
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 16,
    },
});
