import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getDriverSeasonStats } from '../../backend/service/openf1Service';
import type { DriverSeasonStats } from '../../backend/types';

type RouteParams = {
    driverNumber: number;
    year?: number;
    driverName?: string;
    teamName?: string;
    teamColor?: string;
    headshotUrl?: string;
};

interface DriverSeasonState {
    stats: DriverSeasonStats | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const DriverSeasonScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        year,
        driverName,
        teamName,
        teamColor,
        headshotUrl,
    } = route.params;
    const seasonYear = year ?? new Date().getUTCFullYear();

    const [state, setState] = useState<DriverSeasonState>({
        stats: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    const driverContext = useMemo(
        () => ({
            name: driverName,
            team: teamName,
            teamColor,
            headshotUrl,
        }),
        [driverName, teamName, teamColor, headshotUrl]
    );

    const fetchStats = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const stats = await getDriverSeasonStats(driverNumber, seasonYear, driverContext);
                if (!stats) {
                    setState({
                        stats: null,
                        loading: false,
                        refreshing: false,
                        error: 'No stats available for this driver',
                    });
                    return;
                }

                setState({
                    stats,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    stats: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load stats',
                });
            }
        },
        [driverNumber, seasonYear, driverContext]
    );

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleRefresh = useCallback(() => fetchStats(true), [fetchStats]);

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading driver stats...</Text>
            </View>
        );
    }

    if (state.error || !state.stats) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const { driver, season, totals } = state.stats;

    const metricCards = [
        { label: 'Wins', value: totals.wins },
        { label: 'Podiums', value: totals.podiums },
        { label: 'Race Starts', value: totals.races },
        {
            label: 'Avg Race Pos',
            value:
                totals.averageRacePosition != null
                    ? totals.averageRacePosition.toFixed(2)
                    : '-',
        },
        {
            label: 'Avg Quali Pos',
            value:
                totals.averageQualifyingPosition != null
                    ? totals.averageQualifyingPosition.toFixed(2)
                    : '-',
        },
        {
            label: 'Best Race',
            value: totals.bestRaceResult != null ? `P${totals.bestRaceResult}` : '-',
        },
        {
            label: 'Best Quali',
            value: totals.bestQualifyingResult != null ? `P${totals.bestQualifyingResult}` : '-',
        },
        { label: 'Quali Sessions', value: totals.qualifyingSessions },
    ];

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
            <View style={styles.headerCard}>
                <View
                    style={[
                        styles.driverBadge,
                        { backgroundColor: driver.teamColor ? `#${driver.teamColor}` : '#15151E' },
                    ]}
                >
                    <Text style={styles.badgeText}>#{driver.number}</Text>
                </View>
                {driver.headshotUrl ? (
                    <Image source={{ uri: driver.headshotUrl }} style={styles.headshot} />
                ) : (
                    <View style={styles.headshotPlaceholder}>
                        <Text style={styles.headshotInitial}>{driver.name[0]}</Text>
                    </View>
                )}
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name}</Text>
                    <Text style={styles.driverTeam}>{driver.team}</Text>
                    <Text style={styles.driverSeason}>Season {season}</Text>
                </View>
            </View>

    <View style={styles.metricsSection}>
                {metricCards.map(card => (
                    <View key={card.label} style={styles.metricCard}>
                        <Text style={styles.metricLabel}>{card.label}</Text>
                        <Text style={styles.metricValue}>{card.value}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

export default DriverSeasonScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F2',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F2F2F2',
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E10600',
    },
    errorMessage: {
        marginTop: 8,
        color: '#666',
        textAlign: 'center',
    },
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        margin: 16,
        borderRadius: 16,
        padding: 16,
        elevation: 1,
    },
    driverBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 12,
    },
    badgeText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    headshot: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    headshotPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#DDD',
    },
    headshotInitial: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#555',
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#15151E',
    },
    driverTeam: {
        marginTop: 4,
        color: '#666',
    },
    driverSeason: {
        marginTop: 6,
        color: '#999',
    },
    metricsSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    metricCard: {
        width: '48%',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        margin: '1%',
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 13,
        color: '#666',
        textTransform: 'uppercase',
    },
    metricValue: {
        marginTop: 8,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#15151E',
    },
});
