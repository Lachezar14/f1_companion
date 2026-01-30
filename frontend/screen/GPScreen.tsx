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
import { fetchMeetingsByYear, fetchSessionsByMeeting } from '../../backend/api/openf1';
import { Meeting, Session } from '../../backend/types';
import { getRaceSession, getPodium, PodiumFinisher } from '../../backend/service/openf1Service';

type RouteParams = { gpKey: number; year?: number };

interface GPScreenState {
    meeting: Meeting | null;
    sessions: Session[];
    podium: PodiumFinisher[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    podiumError: string | null;
}

export default function GPScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { gpKey, year = 2025 } = route.params;
    const navigation = useNavigation();

    const [state, setState] = useState<GPScreenState>({
        meeting: null,
        sessions: [],
        podium: [],
        loading: true,
        refreshing: false,
        error: null,
        podiumError: null,
    });

    useEffect(() => {
        fetchDetails();
    }, [gpKey, year]);

    /**
     * Fetch meeting and sessions
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
                // Fetch meeting info
                const meetings = await fetchMeetingsByYear(year);
                const meeting = meetings.find(m => m.meeting_key === gpKey);

                if (!meeting) {
                    setState({
                        meeting: null,
                        sessions: [],
                        podium: [],
                        loading: false,
                        refreshing: false,
                        error: 'Meeting not found',
                        podiumError: null,
                    });
                    return;
                }

                // Fetch sessions for this meeting
                const sessions = await fetchSessionsByMeeting(gpKey);

                // Fetch podium data (non-blocking)
                let podium: PodiumFinisher[] = [];
                let podiumError: string | null = null;

                try {
                    const raceSession = await getRaceSession(gpKey);
                    if (raceSession) {
                        podium = await getPodium(raceSession);
                    }
                } catch (error) {
                    console.error('[GPDetailsScreen] Error fetching podium:', error);
                    podiumError = 'Failed to load podium data';
                }

                setState({
                    meeting,
                    sessions,
                    podium,
                    loading: false,
                    refreshing: false,
                    error: null,
                    podiumError,
                });
            } catch (error) {
                console.error('[GPDetailsScreen] Error fetching details:', error);
                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load meeting details',
                }));
            }
        },
        [gpKey, year]
    );

    /**
     * Handle session press
     */
    const handleSessionPress = useCallback(
        (session: Session) => {
            navigation.navigate('FreePracticeScreen' as never, {
                sessionKey: session.session_key,
                sessionName: session.session_name,
                meetingName: state.meeting?.meeting_official_name,
            } as never);
        },
        [navigation, state.meeting]
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

    /**
     * Get icon for session type
     */
    const getSessionIcon = (sessionName: string): string => {
        const name = sessionName.toLowerCase();
        if (name.includes('practice')) return '🏎️';
        if (name.includes('qualifying') || name.includes('sprint shootout')) return '⏱️';
        if (name.includes('sprint')) return '🏁';
        if (name.includes('race')) return '🏆';
        return '📋';
    };

    /**
     * Format session date/time
     */
    const formatSessionDateTime = (dateStart: string): string => {
        const date = new Date(dateStart);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    /**
     * Sort sessions chronologically
     */
    const sortedSessions = [...state.sessions].sort(
        (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );

    // Loading state
    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading GP details...</Text>
            </View>
        );
    }

    // Error state
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

    const { meeting } = state;

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

            {/* Podium Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏆 Race Podium</Text>
                {state.podiumError ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorBoxText}>{state.podiumError}</Text>
                        <TouchableOpacity
                            onPress={handleRetry}
                            style={styles.errorBoxButton}
                        >
                            <Text style={styles.errorBoxButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : state.podium.length > 0 ? (
                    state.podium.map(p => (
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

            {/* Sessions Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Sessions</Text>
                {sortedSessions.length > 0 ? (
                    sortedSessions.map(session => (
                        <TouchableOpacity
                            key={session.session_key}
                            style={styles.sessionCard}
                            activeOpacity={0.7}
                            onPress={() => handleSessionPress(session)}
                        >
                            <View style={styles.sessionIcon}>
                                <Text style={styles.sessionIconText}>
                                    {getSessionIcon(session.session_name)}
                                </Text>
                            </View>

                            <View style={styles.sessionInfo}>
                                <Text style={styles.sessionName}>
                                    {session.session_name}
                                </Text>
                                <Text style={styles.sessionDateTime}>
                                    {formatSessionDateTime(session.date_start)}
                                </Text>
                            </View>

                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.noData}>No sessions available</Text>
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
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    sessionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sessionIconText: {
        fontSize: 24,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 4,
    },
    sessionDateTime: {
        fontSize: 13,
        color: '#666',
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
    refreshHint: {
        fontSize: 12,
        color: '#CCC',
        textAlign: 'center',
        paddingVertical: 24,
    },
    chevron: {
        fontSize: 26,
        color: '#CCC',
        marginLeft: 8,
    },
});