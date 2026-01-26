import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { getGPDetails, GPDetails, PartialErrors, findRaceSession } from '../../backend/service/openf1Service';


type RouteParams = { gpKey: number };

interface GPDetailsState {
    data: GPDetails | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    partialErrors: PartialErrors;
}

export default function GPDetailsScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { gpKey } = route.params;
    const navigation = useNavigation();
    const [raceSessionKey, setRaceSessionKey] = useState<number | null>(null);

    const [state, setState] = useState<GPDetailsState>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
        partialErrors: {},
    });

    useEffect(() => {
        fetchDetails();
    }, [gpKey]);

    /**
     * Fetch GP details using service layer
     */
    const fetchDetails = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
                partialErrors: {},
            }));

            const result = await getGPDetails(gpKey);

            setState({
                data: result.data,
                loading: false,
                refreshing: false,
                error: result.error,
                partialErrors: result.partialErrors,
            });

            // Get race session key for driver pages
            if (result.data) {
                const raceSession = await findRaceSession(gpKey);
                setRaceSessionKey(raceSession?.session_key ?? null);
            }
        },
        [gpKey]
    );

    const handleDriverPress = useCallback(
        (driverNumber: number) => {
            if (!raceSessionKey) {
                console.warn('Race session not loaded yet!');
                return;
            }

            navigation.navigate('DriverOverview' as never, {
                driverNumber,
                sessionKey: raceSessionKey,
            } as never);
        },
        [navigation, raceSessionKey]
    );

    /**
     * Handle pull-to-refresh
     */
    const handleRefresh = useCallback(() => {
        fetchDetails(true);
    }, [fetchDetails]);

    /**
     * Retry loading data
     */
    const handleRetry = useCallback(() => {
        fetchDetails(false);
    }, [fetchDetails]);

    // Loading state
    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading GP details...</Text>
            </View>
        );
    }

    // Error state (complete failure)
    if (state.error || !state.data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>
                    {state.error || 'Meeting not found'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { meeting, pole, podium, drivers } = state.data;
    const { refreshing, partialErrors } = state;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            {/* Track Image */}
            {meeting.circuit_image && (
                <Image
                    source={{ uri: meeting.circuit_image }}
                    style={styles.trackImage}
                    resizeMode="contain"
                />
            )}

            {/* Meeting Info */}
            <View style={styles.header}>
                <Text style={styles.title}>{meeting.meeting_official_name}</Text>
                <Text style={styles.details}>
                    {meeting.circuit_short_name} · {meeting.location},{' '}
                    {meeting.country_name}
                </Text>
                <Text style={styles.date}>
                    {new Date(meeting.date_start).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </Text>
            </View>

            {/* Pole Sitter Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏁 Pole Sitter</Text>
                {partialErrors.pole ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{partialErrors.pole}</Text>
                        <TouchableOpacity
                            onPress={handleRetry}
                            style={styles.errorBoxButton}
                        >
                            <Text style={styles.errorBoxButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : pole ? (
                    <View style={styles.dataCard}>
                        <Text style={styles.driverName}>{pole.driver}</Text>
                        <Text style={styles.constructorName}>
                            {pole.constructor}
                        </Text>
                        {pole.fastestLap && (
                            <Text style={styles.timeText}>⏱️ {pole.fastestLap}</Text>
                        )}
                    </View>
                ) : (
                    <Text style={styles.noData}>
                        Qualifying data not yet available
                    </Text>
                )}
            </View>

            {/* Podium Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏆 Race Podium</Text>
                {partialErrors.podium ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{partialErrors.podium}</Text>
                        <TouchableOpacity
                            onPress={handleRetry}
                            style={styles.errorBoxButton}
                        >
                            <Text style={styles.errorBoxButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : podium.length > 0 ? (
                    podium.map(p => (
                        <View
                            key={p.position}
                            style={[
                                styles.podiumCard,
                                p.position === 1 && styles.podiumCardFirst,
                            ]}
                        >
                            <View style={styles.podiumPosition}>
                                <Text style={styles.positionNumber}>
                                    {p.position}
                                </Text>
                                {p.position === 1 && (
                                    <Text style={styles.positionEmoji}>🥇</Text>
                                )}
                                {p.position === 2 && (
                                    <Text style={styles.positionEmoji}>🥈</Text>
                                )}
                                {p.position === 3 && (
                                    <Text style={styles.positionEmoji}>🥉</Text>
                                )}
                            </View>
                            <View style={styles.podiumInfo}>
                                <Text style={styles.podiumDriver}>{p.driver}</Text>
                                <Text style={styles.podiumConstructor}>
                                    {p.constructor}
                                </Text>
                                {p.time && (
                                    <Text style={styles.podiumTime}>
                                        {p.position === 1 ? '⏱️ ' : '+'}{p.time}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Race data not yet available</Text>
                )}
            </View>

            {/* Drivers Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>👤 Drivers</Text>

                {partialErrors.drivers ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>
                            {partialErrors.drivers}
                        </Text>
                        <TouchableOpacity
                            onPress={handleRetry}
                            style={styles.errorBoxButton}
                        >
                            <Text style={styles.errorBoxButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : drivers && drivers.length > 0 ? (
                    drivers.map(driver => (
                        <TouchableOpacity
                            key={driver.driver_number}
                            style={styles.driverCard}
                            activeOpacity={0.8}
                            onPress={() => handleDriverPress(driver.driver_number)}
                        >
                            {driver.driver_number && (
                                <View style={styles.driverNumber}>
                                    <Text style={styles.driverNumberText}>
                                        {driver.driver_number}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.driverInfo}>
                                <Text style={styles.driverName}>
                                    {driver.full_name}
                                </Text>
                                <Text style={styles.driverConstructor}>
                                    {driver.team_name}
                                </Text>
                            </View>

                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.noData}>
                        Driver list not available
                    </Text>
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
    trackImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#FFF',
    },
    header: {
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 6,
    },
    details: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    date: {
        fontSize: 13,
        color: '#999',
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
    dataCard: {
        backgroundColor: '#F8F8F8',
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    driverName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 4,
    },
    constructorName: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    timeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E10600',
    },
    podiumCard: {
        flexDirection: 'row',
        backgroundColor: '#F8F8F8',
        padding: 14,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: 'center',
    },
    podiumCardFirst: {
        backgroundColor: '#FFF9E6',
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    podiumPosition: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        minWidth: 50,
    },
    positionNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15151E',
        marginRight: 4,
    },
    positionEmoji: {
        fontSize: 20,
    },
    podiumInfo: {
        flex: 1,
    },
    podiumDriver: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 2,
    },
    podiumConstructor: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    podiumTime: {
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
    errorBox: {
        backgroundColor: '#FFE6E6',
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    errorBoxText: {
        fontSize: 14,
        color: '#C00',
        marginBottom: 12,
    },
    errorBoxButton: {
        backgroundColor: '#E10600',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    errorBoxButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    refreshHint: {
        fontSize: 12,
        color: '#CCC',
        textAlign: 'center',
        paddingVertical: 24,
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        padding: 14,
        borderRadius: 8,
        marginBottom: 8,
    },
    driverNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#15151E',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    driverNumberText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    driverInfo: {
        flex: 1,
    },
    driverConstructor: {
        fontSize: 13,
        color: '#666',
    },
    chevron: {
        fontSize: 26,
        color: '#CCC',
        marginLeft: 8,
    },

});