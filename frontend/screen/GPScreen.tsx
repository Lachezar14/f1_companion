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
    Animated,
    StatusBar,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchMeetingsByYear, fetchSessionsByMeeting } from '../../backend/api/openf1';
import { Meeting, Session } from '../../backend/types';
import { getRaceSession, getPodium, PodiumFinisher } from '../../backend/service/openf1Service';
import { theme } from '../../theme';
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

    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(30)).current;

    useEffect(() => {
        fetchDetails();
    }, [gpKey, year]);

    useEffect(() => {
        if (!state.loading && state.meeting) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [state.loading, state.meeting]);

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
                    console.error('[GPScreen] Error fetching podium:', error);
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
                console.error('[GPScreen] Error fetching details:', error);
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

    /**
     * Sort sessions chronologically
     */
    const sortedSessions = [...state.sessions].sort(
        (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );

    /**
     * Format date range
     */
    const formatDateRange = (meeting: Meeting): string => {
        const start = new Date(meeting.date_start);
        const end = new Date(meeting.date_end);

        const startStr = start.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });

        const endStr = end.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        if (start.getDate() === end.getDate()) {
            return endStr;
        }

        return `${startStr} - ${endStr}`;
    };

    // Loading state
    if (state.loading) {
        return (
            <View style={styles.centerContainer}>
                <Animated.View
                    style={{
                        transform: [
                            {
                                rotate: fadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '360deg'],
                                }),
                            },
                        ],
                    }}
                >
                    <Ionicons
                        name="speedometer"
                        size={56}
                        color={theme.colors.primary.red}
                    />
                </Animated.View>
                <Text style={styles.loadingText}>Loading Grand Prix details...</Text>
            </View>
        );
    }

    // Error state
    if (state.error || !state.meeting) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons
                    name="alert-circle"
                    size={64}
                    color={theme.colors.semantic.danger}
                />
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorMessage}>
                    {state.error || 'Meeting not found'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Ionicons name="refresh" size={20} color={theme.colors.neutral.white} />
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { meeting } = state;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={state.refreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.primary.red}
                        colors={[theme.colors.primary.red]}
                    />
                }
            >
                {/* Hero Section with Circuit Image */}
                <View style={styles.heroSection}>
                    {meeting.circuit_image ? (
                        <Image
                            source={{ uri: meeting.circuit_image }}
                            style={styles.circuitImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.circuitImagePlaceholder}>
                            <Ionicons
                                name="map"
                                size={48}
                                color={theme.colors.neutral.gray}
                            />
                        </View>
                    )}

                    {/* Gradient Overlay */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.heroGradient}
                    />

                    {/* Meeting Title Overlay */}
                    <Animated.View
                        style={[
                            styles.heroContent,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Country Flag */}
                        <Image
                            source={{ uri: meeting.country_flag }}
                            style={styles.countryFlag}
                            resizeMode="cover"
                        />

                        <Text style={styles.heroTitle} numberOfLines={2}>
                            {meeting.meeting_name}
                        </Text>
                    </Animated.View>
                </View>

                {/* Meeting Details Card */}
                <Animated.View
                    style={[
                        styles.detailsCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* Racing stripe */}
                    <View style={styles.detailsAccent} />

                    <View style={styles.detailsContent}>
                        {/* Official Name */}
                        <Text style={styles.officialName}>
                            {meeting.meeting_official_name}
                        </Text>

                        {/* Info Grid */}
                        <View style={styles.infoGrid}>
                            {/* Circuit */}
                            <View style={styles.infoItem}>
                                <View style={styles.infoIcon}>
                                    <Ionicons
                                        name="navigate-circle"
                                        size={20}
                                        color={theme.colors.primary.red}
                                    />
                                </View>
                                <View style={styles.infoText}>
                                    <Text style={styles.infoLabel}>Circuit</Text>
                                    <Text style={styles.infoValue}>
                                        {meeting.circuit_short_name}
                                    </Text>
                                </View>
                            </View>

                            {/* Location */}
                            <View style={styles.infoItem}>
                                <View style={styles.infoIcon}>
                                    <Ionicons
                                        name="location"
                                        size={20}
                                        color={theme.colors.primary.red}
                                    />
                                </View>
                                <View style={styles.infoText}>
                                    <Text style={styles.infoLabel}>Location</Text>
                                    <Text style={styles.infoValue}>
                                        {meeting.location}, {meeting.country_name}
                                    </Text>
                                </View>
                            </View>

                            {/* Date */}
                            <View style={styles.infoItem}>
                                <View style={styles.infoIcon}>
                                    <Ionicons
                                        name="calendar"
                                        size={20}
                                        color={theme.colors.primary.red}
                                    />
                                </View>
                                <View style={styles.infoText}>
                                    <Text style={styles.infoLabel}>Date</Text>
                                    <Text style={styles.infoValue}>
                                        {formatDateRange(meeting)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {/* Race Result Section */}
                <RaceResultSection
                    podium={state.podium}
                    podiumError={state.podiumError}
                    onRetry={handleRetry}
                />

                {/* Sessions Section */}
                <View style={styles.sessionsSection}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <View style={styles.sectionIcon}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color={theme.colors.primary.red}
                                />
                            </View>
                            <Text style={styles.sectionTitle}>Weekend Schedule</Text>
                        </View>
                        <View style={styles.sessionCount}>
                            <Text style={styles.sessionCountText}>
                                {sortedSessions.length}
                            </Text>
                        </View>
                    </View>

                    {sortedSessions.length > 0 ? (
                        <View style={styles.sessionsList}>
                            {sortedSessions.map((session, index) => (
                                <SessionCard
                                    key={session.session_key}
                                    session={session}
                                    meetingName={meeting.meeting_official_name}
                                    index={index}
                                />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons
                                name="calendar-outline"
                                size={48}
                                color={theme.colors.neutral.gray}
                            />
                            <Text style={styles.emptyText}>No sessions available</Text>
                            <Text style={styles.emptySubtext}>
                                Sessions will appear closer to race weekend
                            </Text>
                        </View>
                    )}
                </View>

                {/* Pull to refresh hint */}
                <Text style={styles.refreshHint}>Pull down to refresh</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },

    scrollView: {
        flex: 1,
    },

    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background.primary,
    },

    loadingText: {
        marginTop: theme.spacing.base,
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.medium,
        color: theme.colors.text.secondary,
    },

    errorTitle: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.xs,
    },

    errorMessage: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
    },

    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.primary.red,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        gap: theme.spacing.sm,
        ...theme.shadows.md,
    },

    retryButtonText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.bold,
    },

    heroSection: {
        position: 'relative',
        height: 280,
        backgroundColor: theme.colors.neutral.almostBlack,
    },

    circuitImage: {
        width: '100%',
        height: '100%',
    },

    circuitImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.neutral.lightGray,
    },

    heroGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
    },

    heroContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: theme.spacing.base,
        paddingBottom: theme.spacing.xl,
    },

    countryFlag: {
        width: 48,
        height: 32,
        borderRadius: theme.borderRadius.sm,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.neutral.white + '30', // 30% opacity
    },

    heroTitle: {
        fontSize: theme.typography.fontSize['4xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.neutral.white,
        letterSpacing: theme.typography.letterSpacing.tight,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },

    detailsCard: {
        backgroundColor: theme.colors.background.secondary,
        marginHorizontal: theme.spacing.base,
        marginTop: -theme.spacing['2xl'],
        borderRadius: theme.borderRadius.xl,
        ...theme.shadows.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        position: 'relative',
    },

    detailsAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: theme.colors.primary.red,
    },

    detailsContent: {
        padding: theme.spacing.base,
    },

    officialName: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.base,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    infoGrid: {
        gap: theme.spacing.md,
    },

    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    infoIcon: {
        marginRight: theme.spacing.md,
    },

    infoText: {
        flex: 1,
    },

    infoLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
        marginBottom: 2,
    },

    infoValue: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
    },

    sessionsSection: {
        marginTop: theme.spacing.base,
        padding: theme.spacing.base,
    },

    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.base,
    },

    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.primary.red + '15', // 15% opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.sm,
    },

    sectionTitle: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    sessionCount: {
        backgroundColor: theme.colors.primary.carbon,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
    },

    sessionCountText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
    },

    sessionsList: {
        gap: 0, // Gap is handled by SessionCard marginBottom
    },

    emptyState: {
        alignItems: 'center',
        paddingVertical: theme.spacing['4xl'],
    },

    emptyText: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.xs,
    },

    emptySubtext: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
    },

    refreshHint: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.muted,
        textAlign: 'center',
        paddingVertical: theme.spacing.xl,
    },
});