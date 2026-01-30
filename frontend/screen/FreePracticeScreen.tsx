import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Session, Lap } from '../../backend/types';
import {
    getSessionResult,
    getDriversBySession,
    formatLapTime, getLapsBySession
} from '../../backend/service/openf1Service';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

interface DriverSessionData {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    lapCount: number;
    fastestLap: string | null;
    dnf: boolean;
    dns: boolean;
    dsq: boolean;
}

interface FreePracticeData {
    session: Session | null;
    drivers: DriverSessionData[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;
    const navigation = useNavigation();

    const [state, setState] = useState<FreePracticeData>({
        session: null,
        drivers: [],
        loading: true,
        refreshing: false,
        error: null,
    });

    useEffect(() => {
        fetchDetails();
    }, [sessionKey, sessionName]);

    /**
     * OPTIMIZED: Fetch all data in just 3 API calls
     * Before: 2 + (20 drivers × 1) = 22 API calls
     * After: 3 API calls total
     */
    const fetchDetails = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                // Make only 3 API calls instead of 20+
                const [sessionResults, drivers, allLaps] = await Promise.all([
                    getSessionResult(sessionKey),
                    getDriversBySession(sessionKey),
                    getLapsBySession(sessionKey),
                ]);

                if (!sessionResults || !drivers) {
                    setState({
                        session: null,
                        drivers: [],
                        loading: false,
                        refreshing: false,
                        error: 'Failed to load session data',
                    });
                    return;
                }

                // Create driver lookup map
                const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

                // Group laps by driver and calculate stats (all done locally, no API calls)
                const lapsByDriver = new Map<number, { count: number; fastest: number | null }>();

                allLaps.forEach(lap => {
                    if (!lapsByDriver.has(lap.driver_number)) {
                        lapsByDriver.set(lap.driver_number, { count: 0, fastest: null });
                    }

                    const driverLaps = lapsByDriver.get(lap.driver_number)!;
                    driverLaps.count++;

                    // Track fastest lap
                    if (lap.lap_duration != null && lap.lap_duration > 0) {
                        if (driverLaps.fastest === null || lap.lap_duration < driverLaps.fastest) {
                            driverLaps.fastest = lap.lap_duration;
                        }
                    }
                });

                // Build driver data array
                const driverData = sessionResults
                    .map(result => {
                        const driver = driverMap.get(result.driver_number);

                        if (!driver) {
                            return null;
                        }

                        const lapData = lapsByDriver.get(result.driver_number);
                        const lapCount = lapData?.count || 0;
                        const fastestLap = lapData?.fastest ? formatLapTime(lapData.fastest) : null;

                        return {
                            position: result.position,
                            driverNumber: result.driver_number,
                            driverName: driver.full_name,
                            teamName: driver.team_name,
                            lapCount,
                            fastestLap,
                            dnf: result.dnf || false,
                            dns: result.dns || false,
                            dsq: result.dsq || false,
                        };
                    })
                    .filter((d): d is DriverSessionData => d !== null);

                // Sort by position
                driverData.sort((a, b) => {
                    if (a.position === null && b.position === null) return 0;
                    if (a.position === null) return 1;
                    if (b.position === null) return -1;
                    return a.position - b.position;
                });

                setState({
                    session: null,
                    drivers: driverData,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                console.error('[SessionDetailsScreen] Error fetching details:', error);
                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load session details',
                }));
            }
        },
        [sessionKey]
    );

    const handleRefresh = useCallback(() => {
        fetchDetails(true);
    }, [fetchDetails]);

    const handleRetry = useCallback(() => {
        fetchDetails(false);
    }, [fetchDetails]);

    const formatPosition = (driver: DriverSessionData): string => {
        if (driver.dns) return 'DNS';
        if (driver.dnf) return 'DNF';
        if (driver.dsq) return 'DSQ';
        if (driver.position) return `P${driver.position}`;
        return '-';
    };

    const getPositionColor = (driver: DriverSessionData): string => {
        if (driver.dns || driver.dnf || driver.dsq) return '#999';
        if (driver.position === 1) return '#FFD700';
        if (driver.position === 2) return '#C0C0C0';
        if (driver.position === 3) return '#CD7F32';
        return '#15151E';
    };

    // Loading state
    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading session details...</Text>
            </View>
        );
    }

    // Error state
    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>{state.error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
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
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
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

                {state.drivers.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderPos}>Pos</Text>
                            <Text style={styles.tableHeaderDriver}>Driver</Text>
                            <Text style={styles.tableHeaderLaps}>Laps</Text>
                            <Text style={styles.tableHeaderTime}>Best Time</Text>
                        </View>

                        {/* Driver Rows */}
                        {state.drivers.map((driver) => (
                            <View
                                key={driver.driverNumber}
                                style={[
                                    styles.driverRow,
                                    driver.position === 1 && styles.driverRowFirst,
                                ]}
                            >
                                <View style={styles.positionCell}>
                                    <Text
                                        style={[
                                            styles.positionText,
                                            { color: getPositionColor(driver) },
                                        ]}
                                    >
                                        {formatPosition(driver)}
                                    </Text>
                                </View>

                                <View style={styles.driverCell}>
                                    <View style={styles.driverNumber}>
                                        <Text style={styles.driverNumberText}>
                                            {driver.driverNumber}
                                        </Text>
                                    </View>
                                    <View style={styles.driverInfo}>
                                        <Text style={styles.driverName}>
                                            {driver.driverName}
                                        </Text>
                                        <Text style={styles.teamName}>
                                            {driver.teamName}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.lapsCell}>
                                    <Text style={styles.lapsText}>{driver.lapCount}</Text>
                                </View>

                                <View style={styles.timeCell}>
                                    <Text style={styles.timeText}>
                                        {driver.fastestLap || '-'}
                                    </Text>
                                </View>
                            </View>
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
    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        padding: 12,
        borderRadius: 8,
        marginBottom: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#E0E0E0',
    },
    driverRowFirst: {
        backgroundColor: '#FFF9E6',
        borderLeftColor: '#FFD700',
    },
    positionCell: {
        width: 50,
        alignItems: 'flex-start',
    },
    positionText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    driverCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#15151E',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    driverNumberText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 2,
    },
    teamName: {
        fontSize: 12,
        color: '#666',
    },
    lapsCell: {
        width: 50,
        alignItems: 'center',
    },
    lapsText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    timeCell: {
        width: 80,
        alignItems: 'flex-end',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E10600',
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