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
import { RouteProp, useRoute } from '@react-navigation/native';
import {
    getMeetingsByYear,
    getPoleSitterByMeeting,
    getRacePodiumByMeeting,
    PoleSitter,
    PodiumFinisher,
} from '../api/openf1';
import { Meeting } from '../api/types';

type RouteParams = { gpKey: number };

interface GPDetailsState {
    meeting: Meeting | null;
    pole: PoleSitter | null;
    podium: PodiumFinisher[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    partialError: {
        pole?: string;
        podium?: string;
    };
}

export default function GPDetailsScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { gpKey } = route.params;

    const [state, setState] = useState<GPDetailsState>({
        meeting: null,
        pole: null,
        podium: [],
        loading: true,
        refreshing: false,
        error: null,
        partialError: {},
    });

    useEffect(() => {
        fetchDetails();
    }, [gpKey]);

    /**
     * Fetch all GP details with robust error handling
     */
    const fetchDetails = useCallback(
        async (isRefresh = false) => {
            try {
                // Set loading state
                setState(prev => ({
                    ...prev,
                    loading: !isRefresh,
                    refreshing: isRefresh,
                    error: null,
                    partialError: {},
                }));

                // 1. Fetch meeting info first
                const meetings = await getMeetingsByYear(2025);
                const thisMeeting = meetings.find(m => m.meeting_key === gpKey);

                if (!thisMeeting) {
                    setState({
                        meeting: null,
                        pole: null,
                        podium: [],
                        loading: false,
                        refreshing: false,
                        error: 'Meeting not found',
                        partialError: {},
                    });
                    return;
                }

                // Update meeting immediately
                setState(prev => ({ ...prev, meeting: thisMeeting }));

                // 2. Fetch pole and podium in parallel with individual error handling
                const results = await Promise.allSettled([
                    getPoleSitterByMeeting(gpKey),
                    getRacePodiumByMeeting(gpKey),
                ]);

                // Extract results
                const pole =
                    results[0].status === 'fulfilled' ? results[0].value : null;
                const podium =
                    results[1].status === 'fulfilled' ? results[1].value : [];

                // Track partial errors
                const partialError: GPDetailsState['partialError'] = {};

                if (results[0].status === 'rejected') {
                    console.error('Pole sitter fetch failed:', results[0].reason);
                    partialError.pole = 'Failed to load pole sitter data';
                }

                if (results[1].status === 'rejected') {
                    console.error('Podium fetch failed:', results[1].reason);
                    partialError.podium = 'Failed to load podium data';
                }

                // Update state with all data
                setState({
                    meeting: thisMeeting,
                    pole,
                    podium,
                    loading: false,
                    refreshing: false,
                    error: null,
                    partialError,
                });
            } catch (error) {
                console.error('Failed to fetch GP details:', error);

                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to load meeting details',
                }));
            }
        },
        [gpKey]
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
    if (state.error || !state.meeting) {
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

    const { meeting, pole, podium, refreshing, partialError } = state;

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
                {partialError.pole ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{partialError.pole}</Text>
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
                {partialError.podium ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{partialError.podium}</Text>
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
});