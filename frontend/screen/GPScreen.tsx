import React, { useCallback, useMemo } from 'react';
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
import { Meeting, Session } from '../../backend/types';
import {
    getMeetingByKey,
    getSessionsByMeeting,
    getRaceSession,
    getPodium,
    PodiumFinisher,
} from '../../backend/service/openf1Service';
import RaceResultSection from '../component/session/RaceResultSection';
import SessionCard from '../component/session/SessionCard';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { DEFAULT_MEETING_YEAR } from '../config/appConfig';

type RouteParams = { gpKey: number; year?: number };

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

type MeetingDetails = {
    meeting: Meeting;
    sessions: Session[];
    podium: PodiumFinisher[];
    podiumError: string | null;
};

export default function GPScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { gpKey, year = DEFAULT_MEETING_YEAR } = route.params;
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    const loadMeetingDetails = useCallback(async (): Promise<MeetingDetails> => {
        const meeting = await getMeetingByKey(gpKey);
        if (!meeting) {
            throw new Error(`Meeting ${gpKey} not found for ${year}`);
        }

        const sessions = await getSessionsByMeeting(gpKey);

        let podium: PodiumFinisher[] = [];
        let podiumError: string | null = null;

        const raceSession = await getRaceSession(gpKey);
        if (raceSession) {
            try {
                podium = await getPodium(raceSession);
            } catch (error) {
                console.error('[GPScreen] Error fetching podium:', error);
                podiumError =
                    error instanceof Error ? error.message : 'Failed to load podium data';
            }
        }

        return { meeting, sessions, podium, podiumError };
    }, [gpKey, year]);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest(loadMeetingDetails, [loadMeetingDetails]);

    const meetingNameForNav = data?.meeting.meeting_official_name ?? null;

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

    const sortedSessions = useMemo(() => {
        if (!data?.sessions) {
            return [];
        }

        return [...data.sessions].sort(
            (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
        );
    }, [data?.sessions]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading GP details...</Text>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>{error || 'Meeting not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { meeting, podium, podiumError } = data;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            {meeting.circuit_image && (
                <Image
                    source={{ uri: meeting.circuit_image }}
                    style={styles.trackImage}
                    resizeMode="contain"
                />
            )}

            <View style={styles.header}>
                <Text style={styles.title}>{meeting.meeting_official_name}</Text>
                <Text style={styles.details}>
                    {meeting.circuit_short_name} · {meeting.location}, {meeting.country_name}
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

            <RaceResultSection podium={podium} podiumError={podiumError} onRetry={reload} />

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
