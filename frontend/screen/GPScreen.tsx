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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchMeetingsByYear, fetchSessionsByMeeting } from '../../backend/api/openf1';
import { Meeting, Session } from '../../backend/types';
import { getRaceSession, getPodium, PodiumFinisher } from '../../backend/service/openf1Service';
import RaceResultSection from "../component/session/RaceResultSection";
import SessionCard from "../component/session/SessionCard";

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

type SessionScreenTarget = 'FreePracticeScreen' | 'QualifyingScreen' | 'RaceScreen';

const resolveSessionScreen = (session: Session): SessionScreenTarget => {
    const normalized = `${session.session_type || ''} ${session.session_name}`.toLowerCase();

    if (normalized.includes('shootout') || normalized.includes('qualifying')) {
        return 'QualifyingScreen';
    }

    if (
        normalized.includes('race') ||
        normalized.includes('grand prix') ||
        (normalized.includes('sprint') && !normalized.includes('shootout'))
    ) {
        return 'RaceScreen';
    }

    return 'FreePracticeScreen';
};

export default function GPScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { gpKey, year = 2025 } = route.params;
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    const [state, setState] = useState<GPScreenState>({
        meeting: null,
        sessions: [],
        podium: [],
        loading: true,
        refreshing: false,
        error: null,
        podiumError: null,
    });
    const meetingNameForNav = state.meeting?.meeting_official_name || null;

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

    const handleSessionPress = useCallback(
        (session: Session) => {
            const targetScreen = resolveSessionScreen(session);

            navigation.navigate(targetScreen, {
                sessionKey: session.session_key,
                sessionName: session.session_name,
                meetingName: meetingNameForNav ?? session.session_name,
            });
        },
        [navigation, meetingNameForNav]
    );

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

            {/* Race Result Section - Now using RaceResultSection component */}
            <RaceResultSection
                podium={state.podium}
                podiumError={state.podiumError}
                onRetry={handleRetry}
            />

            {/* Sessions Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Sessions</Text>
                {sortedSessions.length > 0 ? (
                    sortedSessions.map(session => (
                        <SessionCard
                            key={session.session_key}
                            session={session}
                            meetingName={meeting.meeting_official_name}
                            onPress={handleSessionPress}
                        />
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
