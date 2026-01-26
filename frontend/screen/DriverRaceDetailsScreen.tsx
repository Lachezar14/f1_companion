import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { DriverRaceOverview, formatLapTime, getDriverRaceOverview } from '../../backend/service/openf1Service';
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

export default function DriverOverviewScreen() {
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

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error || !state.data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const driver = state.data;

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
            <View style={styles.header}>
                <Text style={styles.name}>{driver.driver.name}</Text>
                <Text style={styles.team}>{driver.driver.team}</Text>
                <Text style={styles.number}>#{driver.driver.number}</Text>
            </View>

            {/* Stints */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stints</Text>
                {driver.stints.length > 0 ? (
                    driver.stints.map((stint: Stint, idx) => (
                        <View key={idx} style={styles.card}>
                            <Text style={styles.cardTitle}>Stint {stint.stint_number}</Text>
                            <Text style={styles.cardDetail}>Compound: {stint.compound} ({stint.tyre_age_at_start})</Text>
                            <Text style={styles.cardDetail}>Laps: {stint.lap_start}-{stint.lap_end}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Stints data not available</Text>
                )}
            </View>

            {/* Laps */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lap Times</Text>
                {driver.laps.length > 0 ? (
                    driver.laps.map((lap: Lap, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.card,
                                lap.is_pit_out_lap ? { backgroundColor: '#FFF0F0' } : {},
                            ]}
                        >
                            <Text style={styles.cardTitle}>
                                Lap {lap.lap_number} {lap.is_pit_out_lap ? '(Pit Out)' : ''}
                            </Text>
                            <Text style={styles.cardDetail}>Time: {formatLapTime(lap.lap_duration)}</Text>
                            <Text style={styles.cardDetail}>
                                Sectors: {lap.duration_sector_1 ?? '-'} | {lap.duration_sector_2 ?? '-'} | {lap.duration_sector_3 ?? '-'}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Lap times not available</Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#333' },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E10600', marginBottom: 8 },
    errorMessage: { fontSize: 16, color: '#333', textAlign: 'center' },
    header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center' },
    name: { fontSize: 26, fontWeight: 'bold', color: '#E10600', marginBottom: 4 },
    team: { fontSize: 18, color: '#333', marginBottom: 4 },
    number: { fontSize: 18, fontWeight: '600', color: '#FFD700' },
    section: { padding: 16, marginTop: 12 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    card: {
        backgroundColor: '#FFF',
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EEE',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#E10600', marginBottom: 4 },
    cardDetail: { fontSize: 14, color: '#333', marginBottom: 2 },
    noData: { fontSize: 14, color: '#888', fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
});
