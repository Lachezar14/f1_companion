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
import { Lap } from '../../backend/types';
import {
    getSessionResults,
    getDriversBySession,
    getLapsBySession
} from '../../backend/service/openf1Service';
import FreePracticeResultCard, { DriverSessionData } from "../component/session/FreePracticeResultCard";
import { formatLapTime } from '../../shared/time';
import { useServiceRequest } from '../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadSessionDrivers = useCallback(async (): Promise<DriverSessionData[]> => {
        const [sessionResults, drivers, allLaps] = await Promise.all([
            getSessionResults(sessionKey),
            getDriversBySession(sessionKey),
            getLapsBySession(sessionKey),
        ]);

        const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

        const lapsByDriver = new Map<number, { count: number; fastest: number | null }>();

        allLaps.forEach((lap: Lap) => {
            if (!lapsByDriver.has(lap.driver_number)) {
                lapsByDriver.set(lap.driver_number, { count: 0, fastest: null });
            }

            const driverLaps = lapsByDriver.get(lap.driver_number)!;
            driverLaps.count++;

            if (lap.lap_duration != null && lap.lap_duration > 0) {
                if (driverLaps.fastest === null || lap.lap_duration < driverLaps.fastest) {
                    driverLaps.fastest = lap.lap_duration;
                }
            }
        });

        const driverData: DriverSessionData[] = [];
        sessionResults.forEach(result => {
            const driver = driverMap.get(result.driver_number);
            if (!driver) {
                return;
            }

            const lapData = lapsByDriver.get(result.driver_number);
            const lapCount = lapData?.count || 0;
            const fastestLap = lapData?.fastest ? formatLapTime(lapData.fastest) : null;

            driverData.push({
                position: result.position,
                driverNumber: result.driver_number,
                driverName: driver.full_name,
                teamName: driver.team_name,
                lapCount,
                fastestLap,
                dnf: result.dnf || false,
                dns: result.dns || false,
                dsq: result.dsq || false,
                teamColor: driver.team_colour || undefined,
            });
        });

        const normalizePosition = (driver: DriverSessionData) =>
            driver.position ?? Number.MAX_SAFE_INTEGER;

        driverData.sort((a, b) => normalizePosition(a) - normalizePosition(b));

        return driverData;
    }, [sessionKey]);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest(loadSessionDrivers, [loadSessionDrivers]);

    const drivers = data ?? [];

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
