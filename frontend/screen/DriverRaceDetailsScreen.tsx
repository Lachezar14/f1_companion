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
import { getDriversBySession } from '../../backend/service/openf1Service';
import {Driver} from "../../backend/types";

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
};

interface DriverState {
    data: Driver | null;
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

    // Fetch driver details
    const fetchDriver = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const drivers = await getDriversBySession(sessionKey);
                const driver = drivers?.find(d => d.driver_number === driverNumber) ?? null;

                if (!driver) {
                    setState({
                        data: null,
                        loading: false,
                        refreshing: false,
                        error: 'Driver data not found for this session',
                    });
                    return;
                }

                setState({
                    data: driver,
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
            <View style={styles.header}>
                <Text style={styles.name}>{driver.full_name}</Text>
                <Text style={styles.team}>{driver.team_name}</Text>
                {driver.driver_number && (
                    <Text style={styles.number}>#{driver.driver_number}</Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance</Text>
                {driver.best_lap_time && (
                    <Text style={styles.detail}>Best Lap: {driver.best_lap_time}</Text>
                )}
                {driver.total_race_time && (
                    <Text style={styles.detail}>Total Race Time: {driver.total_race_time}</Text>
                )}
                {driver.position && (
                    <Text style={styles.detail}>Position: {driver.position}</Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lap Times</Text>
                {driver.laps && driver.laps.length > 0 ? (
                    driver.laps.map((lap, idx) => (
                        <Text key={idx} style={styles.detail}>
                            Lap {lap.lap_number}: {lap.time}
                        </Text>
                    ))
                ) : (
                    <Text style={styles.noData}>Lap times not available</Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F2' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E10600', marginBottom: 8 },
    errorMessage: { fontSize: 16, color: '#666', textAlign: 'center' },
    header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    name: { fontSize: 22, fontWeight: 'bold', color: '#15151E', marginBottom: 4 },
    team: { fontSize: 16, color: '#666', marginBottom: 4 },
    number: { fontSize: 16, fontWeight: '600', color: '#E10600' },
    section: { backgroundColor: '#FFF', padding: 16, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E0E0E0' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#15151E', marginBottom: 8 },
    detail: { fontSize: 14, color: '#15151E', marginBottom: 4 },
    noData: { fontSize: 14, color: '#999', fontStyle: 'italic', paddingVertical: 12 },
});
