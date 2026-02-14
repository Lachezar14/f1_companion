import React, { useCallback, useMemo } from 'react';
import { overlays, radius, semanticColors, spacing, typography } from '../theme/tokens';
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
                <ActivityIndicator size="large" color={semanticColors.danger} />
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
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
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
        backgroundColor: semanticColors.backgroundMuted,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.backgroundMuted,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.lg,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.lg,
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
    },
    heroCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: semanticColors.textPrimary,
        marginHorizontal: spacing.sm,
        marginTop: spacing.md,
        borderRadius: radius.lg,
        padding: spacing.lg,
        overflow: 'hidden',
    },
    heroContent: {
        flex: 1,
    },
    heroTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginBottom: spacing.xs,
    },
    heroSubtitle: {
        fontSize: typography.size.lg,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: spacing.xs,
    },
    heroDates: {
        fontSize: typography.size.base,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: spacing.sm,
    },
    heroImage: {
        width: 130,
        height: 110,
        marginLeft: spacing.md,
        opacity: 0.9,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    chip: {
        borderRadius: radius.lg,
        backgroundColor: overlays.white15,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    chipText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.semibold,
        fontSize: typography.size.sm,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    flagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    flag: {
        width: 36,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    countryCode: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.lg,
        letterSpacing: typography.letterSpacing.wider,
    },
    detailsCard: {
        backgroundColor: semanticColors.surface,
        marginTop: spacing.md,
        marginHorizontal: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    detailsTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.md,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    detailItem: {
        width: '48%',
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#EFEFEF',
        marginBottom: spacing.sm,
    },
    detailLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    detailValue: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
        marginTop: spacing.xxs,
    },
    section: {
        backgroundColor: semanticColors.surface,
        padding: spacing.md,
        marginTop: spacing.md,
        borderRadius: radius.lg,
        marginHorizontal: spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    sectionTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.sm,
    },
    noData: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: spacing.sm,
    },
    refreshHint: {
        fontSize: typography.size.sm,
        color: semanticColors.borderStrong,
        textAlign: 'center',
        paddingVertical: spacing.xl,
    },
});
