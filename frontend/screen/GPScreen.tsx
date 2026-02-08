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
} from '../../backend/service/openf1Service';
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
        return { meeting, sessions };
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

    const { meeting } = data;

    const formatDateRange = (startIso: string, endIso: string): string => {
        const startDate = new Date(startIso);
        const endDate = new Date(endIso);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return 'TBC';
        }

        if (startDate.toDateString() === endDate.toDateString()) {
            return startDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }

        const startLabel = startDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
        });
        const endLabel = endDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
        return `${startLabel} - ${endLabel}`;
    };

    const dateRange = formatDateRange(meeting.date_start, meeting.date_end);

    const detailRows = [
        {
            label: 'Location',
            value: `${meeting.location}, ${meeting.country_name}`,
        },
        {
            label: 'Circuit',
            value: meeting.circuit_short_name || meeting.circuit_type || '—',
        },
        {
            label: 'Circuit Type',
            value: meeting.circuit_type || 'N/A',
        },
        {
            label: 'Dates',
            value: dateRange,
        },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <View style={styles.flagRow}>
                        {meeting.country_flag ? (
                            <Image source={{ uri: meeting.country_flag }} style={styles.flag} />
                        ) : null}
                        <Text style={styles.countryCode}>{meeting.country_code}</Text>
                    </View>
                    <Text style={styles.heroTitle}>{meeting.meeting_official_name}</Text>
                    <Text style={styles.heroSubtitle}>{meeting.location}</Text>
                    <Text style={styles.heroDates}>{dateRange}</Text>
                    <View style={styles.chipRow}>
                        {meeting.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{meeting.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        {meeting.circuit_type ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{meeting.circuit_type}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                {meeting.circuit_image ? (
                    <Image
                        source={{ uri: meeting.circuit_image }}
                        style={styles.heroImage}
                        resizeMode="contain"
                    />
                ) : null}
            </View>

            <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>Grand Prix Details</Text>
                <View style={styles.detailsGrid}>
                    {detailRows.map(row => (
                        <View key={row.label} style={styles.detailItem}>
                            <Text style={styles.detailLabel}>{row.label}</Text>
                            <Text style={styles.detailValue}>{row.value || '—'}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weekend Schedule</Text>
                {sortedSessions.length > 0 ? (
                    sortedSessions.map((session, index) => (
                        <SessionCard
                            key={session.session_key}
                            session={session}
                            onPress={handleSessionPress}
                            showDivider={index < sortedSessions.length - 1}
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
    heroCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#15151E',
        marginHorizontal: 12,
        marginTop: 16,
        borderRadius: 18,
        padding: 20,
        overflow: 'hidden',
    },
    heroContent: {
        flex: 1,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 6,
    },
    heroSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 6,
    },
    heroDates: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 12,
    },
    heroImage: {
        width: 130,
        height: 110,
        marginLeft: 16,
        opacity: 0.9,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    chipText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 12,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    flagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    flag: {
        width: 36,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    countryCode: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 1,
    },
    detailsCard: {
        backgroundColor: '#FFF',
        marginTop: 16,
        marginHorizontal: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E6E6',
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 16,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    detailItem: {
        width: '48%',
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#EFEFEF',
        marginBottom: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: '#777',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#15151E',
        marginTop: 4,
    },
    section: {
        backgroundColor: '#FFF',
        padding: 16,
        marginTop: 16,
        borderRadius: 16,
        marginHorizontal: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E6E6',
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
