import React, { useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getPracticeSessionDetail } from '../../../../backend/service/openf1Service';
import FreePracticeResultCard, { DriverSessionData } from "../../../component/session/FreePracticeResultCard";
import { formatLapTime } from '../../../../shared/time';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import type { PracticeSessionDetail } from '../../../../backend/types';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadSessionDrivers = useCallback(
        () => getPracticeSessionDetail(sessionKey),
        [sessionKey]
    );

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<PracticeSessionDetail>(loadSessionDrivers, [loadSessionDrivers]);

    const driverEntries = data?.drivers ?? [];

    const drivers: DriverSessionData[] = driverEntries
        .map(entry => {
            const fastestLapSeconds = entry.laps
                .filter(lap => lap.lap_duration && lap.lap_duration > 0)
                .reduce<number | null>((best, lap) => {
                    if (lap.lap_duration == null) return best;
                    if (best == null || lap.lap_duration < best) {
                        return lap.lap_duration;
                    }
                    return best;
                }, null);

            return {
                position: entry.sessionResult?.position ?? null,
                driverNumber: entry.driver.number,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                lapCount: entry.laps.length,
                fastestLap: fastestLapSeconds ? formatLapTime(fastestLapSeconds) : null,
                dnf: entry.sessionResult?.dnf ?? false,
                dns: entry.sessionResult?.dns ?? false,
                dsq: entry.sessionResult?.dsq ?? false,
                teamColor: entry.driver.teamColor ?? undefined,
                driverEntry: entry,
            };
        })
        .sort((a, b) => {
            const posA = a.position ?? Number.MAX_SAFE_INTEGER;
            const posB = b.position ?? Number.MAX_SAFE_INTEGER;
            return posA - posB;
        });

    // Loading state
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading session details...</Text>
            </View>
        );
    }

    // Error state
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor="#E10600"
                />
            }
        >
            {/* Session Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{sessionName}</Text>
                {meetingName && (
                    <Text style={styles.meetingName}>{meetingName}</Text>
                )}
            </View>

            {/* Driver Timetable */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Session Results</Text>

                {drivers.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderPos}>Pos</Text>
                            <Text style={styles.tableHeaderDriver}>Driver</Text>
                            <Text style={styles.tableHeaderLaps}>Laps</Text>
                            <Text style={styles.tableHeaderTime}>Best Time</Text>
                        </View>

                        {/* Driver Rows - Now using FreePracticeResultCard component */}
                        {drivers.map(driver => (
                            <FreePracticeResultCard
                                key={driver.driverNumber}
                                driver={driver}
                                sessionKey={sessionKey}
                                isFirst={driver.position === 1}
                            />
                        ))}
                    </>
                ) : (
                    <Text style={styles.noData}>No session data available</Text>
                )}
            </View>

            {/* Pull to refresh hint */}
            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
}

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
        fontSize: 16,
        color: '#666',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#E10600',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    header: {
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 4,
    },
    meetingName: {
        fontSize: 14,
        color: '#666',
    },
    section: {
        backgroundColor: '#FFF',
        padding: 16,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 12,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8F8F8',
        borderRadius: 6,
        marginBottom: 8,
    },
    tableHeaderPos: {
        width: 50,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    tableHeaderDriver: {
        flex: 1,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    tableHeaderLaps: {
        width: 50,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'center',
    },
    tableHeaderTime: {
        width: 80,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'right',
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
    refreshHint: {
        fontSize: 12,
        color: '#CCC',
        textAlign: 'center',
        paddingVertical: 24,
    },
});
