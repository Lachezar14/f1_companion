import React, { useCallback, useMemo } from 'react';
import {
    colors,
    overlays,
    radius,
    semanticColors,
    shadows,
    spacing,
    typography,
} from '../theme/tokens';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getMeetingByKey,
    getSessionsByMeeting,
    getDriversBySession,
    getSessionResults,
} from '../../backend/service/openf1Service';
import { Driver, Meeting, Session, SessionResult } from '../../backend/types';
import SessionCard from '../component/session/SessionCard';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { DEFAULT_MEETING_YEAR } from '../config/appConfig';
import { deriveDriverCode, getDriverInitials } from '../../utils/driver';
import { formatLapTime } from '../../shared/time';

type RouteParams = { gpKey: number; year?: number };

type SessionScreenTarget = 'FreePracticeScreen' | 'QualifyingScreen' | 'RaceScreen';
type SessionLifecycle = 'upcoming' | 'live' | 'completed' | 'tbc';

type PodiumEntry = {
    position: 1 | 2 | 3;
    driverInitials: string;
    driverCode: string;
    headshotUrl: string | null;
    team: string;
};

type QualifyingHighlight = {
    session: Session | null;
    lifecycle: SessionLifecycle;
    statusText: string;
    poleSitter: string | null;
    poleLap: string | null;
    poleDriverInitials: string | null;
    poleHeadshotUrl: string | null;
    poleTeam: string | null;
};

type RaceHighlight = {
    session: Session | null;
    lifecycle: SessionLifecycle;
    statusText: string;
    podium: PodiumEntry[];
};

type WeekendHighlights = {
    qualifying: QualifyingHighlight;
    race: RaceHighlight;
};

type TestingOverview = {
    total: number;
    completed: number;
    live: number;
    upcoming: number;
};

type MeetingDetails = {
    meeting: Meeting;
    sessions: Session[];
    isTestingMeeting: boolean;
    testingOverview: TestingOverview | null;
    highlights: WeekendHighlights | null;
};

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

const getNormalizedSessionText = (session: Session): string =>
    `${session.session_type || ''} ${session.session_name || ''}`.toLowerCase();

const sortByStartAsc = (a: Session, b: Session) =>
    new Date(a.date_start).getTime() - new Date(b.date_start).getTime();

const getSessionLifecycle = (session: Session): SessionLifecycle => {
    const start = new Date(session.date_start).getTime();
    const end = new Date(session.date_end).getTime();

    if (Number.isNaN(start)) {
        return 'tbc';
    }

    const normalizedEnd = Number.isNaN(end) ? start : end;
    const now = Date.now();

    if (now < start) {
        return 'upcoming';
    }

    if (now > normalizedEnd) {
        return 'completed';
    }

    return 'live';
};

const formatDateRange = (startIso: string, endIso: string): string => {
    const startDate = new Date(startIso);
    const endDate = new Date(endIso);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return 'Dates TBC';
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
        month: 'short',
        day: 'numeric',
    });
    const endLabel = endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `${startLabel} - ${endLabel}`;
};

const formatSessionStart = (session: Session): string => {
    const start = new Date(session.date_start);

    if (Number.isNaN(start.getTime())) {
        return 'Schedule pending';
    }

    const day = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const time = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return `${day} · ${time}`;
};

const formatLifecycleLabel = (session: Session | null, lifecycle: SessionLifecycle): string => {
    if (!session) {
        return 'Not scheduled';
    }

    if (lifecycle === 'live') {
        return 'In progress';
    }

    if (lifecycle === 'upcoming') {
        return `Starts ${formatSessionStart(session)}`;
    }

    if (lifecycle === 'completed') {
        return 'Completed';
    }

    return 'Schedule pending';
};

const selectQualifyingSession = (sessions: Session[]): Session | null => {
    const ordered = [...sessions].sort(sortByStartAsc);

    const primary = ordered.find(session => {
        const text = getNormalizedSessionText(session);
        return text.includes('qualifying') && !text.includes('sprint');
    });

    if (primary) {
        return primary;
    }

    return (
        ordered.find(session => {
            const text = getNormalizedSessionText(session);
            return text.includes('qualifying') || text.includes('shootout');
        }) || null
    );
};

const selectRaceSession = (sessions: Session[]): Session | null => {
    const ordered = [...sessions].sort(sortByStartAsc);

    const mainRace = ordered.find(session => {
        const text = getNormalizedSessionText(session);
        const isRaceLike = text.includes('race') || text.includes('grand prix');
        return isRaceLike && !text.includes('sprint') && !text.includes('shootout');
    });

    if (mainRace) {
        return mainRace;
    }

    return (
        ordered.find(session => {
            const text = getNormalizedSessionText(session);
            return text.includes('race') || text.includes('grand prix');
        }) || null
    );
};

const isPositiveNumber = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const toSortablePosition = (position: number | null | undefined): number =>
    isPositiveNumber(position) ? position : Number.POSITIVE_INFINITY;

const getBestQualifyingLap = (result: SessionResult): string | null => {
    if (!Array.isArray(result.duration)) {
        return null;
    }

    const q3 = result.duration[2];
    if (isPositiveNumber(q3)) {
        return formatLapTime(q3);
    }

    const validSegments = result.duration.filter(isPositiveNumber);
    if (!validSegments.length) {
        return null;
    }

    return formatLapTime(Math.min(...validSegments));
};

const normalizeHeadshotUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://')) {
        return `https://${trimmed.slice('http://'.length)}`;
    }
    return trimmed;
};

type DriverHighlightIdentity = {
    driverInitials: string;
    driverCode: string;
    headshotUrl: string | null;
    team: string;
};

const buildDriverHighlightIdentity = (driver?: Driver): DriverHighlightIdentity => {
    const displayName = driver?.full_name?.trim()
        || driver?.broadcast_name?.trim()
        || driver?.name_acronym?.trim()
        || `#${driver?.driver_number ?? ''}`;

    return {
        driverInitials: getDriverInitials(displayName, 2),
        driverCode: driver?.name_acronym?.trim() || deriveDriverCode(displayName),
        headshotUrl: normalizeHeadshotUrl(driver?.headshot_url || null),
        team: driver?.team_name || 'Unknown Team',
    };
};

const buildQualifyingHighlight = async (
    session: Session | null,
    raceSession: Session | null
): Promise<QualifyingHighlight> => {
    if (!session) {
        return {
            session: null,
            lifecycle: 'tbc',
            statusText: 'Not scheduled',
            poleSitter: null,
            poleLap: null,
            poleDriverInitials: null,
            poleHeadshotUrl: null,
            poleTeam: null,
        };
    }

    const lifecycle = getSessionLifecycle(session);

    if (lifecycle !== 'completed') {
        return {
            session,
            lifecycle,
            statusText: formatLifecycleLabel(session, lifecycle),
            poleSitter: null,
            poleLap: null,
            poleDriverInitials: null,
            poleHeadshotUrl: null,
            poleTeam: null,
        };
    }

    try {
        const [results, drivers, raceDrivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySession(session.session_key),
            raceSession ? getDriversBySession(raceSession.session_key) : Promise.resolve([]),
        ]);
        const sortedResults = [...results].sort(
            (a, b) => toSortablePosition(a.position) - toSortablePosition(b.position)
        );
        const poleResult = sortedResults.find(row => row.position === 1) ?? sortedResults[0] ?? null;

        if (!poleResult) {
            return {
                session,
                lifecycle,
                statusText: 'Completed · results pending',
                poleSitter: null,
                poleLap: null,
                poleDriverInitials: null,
                poleHeadshotUrl: null,
                poleTeam: null,
            };
        }

        const poleDriver =
            drivers.find(driver => driver.driver_number === poleResult.driver_number)
            || drivers.find(driver => String(driver.driver_number) === String(poleResult.driver_number));
        const racePoleDriver =
            raceDrivers.find(driver => driver.driver_number === poleResult.driver_number)
            || raceDrivers.find(
                driver => String(driver.driver_number) === String(poleResult.driver_number)
            );
        const poleIdentity = buildDriverHighlightIdentity(
            (poleDriver?.headshot_url ? poleDriver : racePoleDriver) ?? poleDriver ?? racePoleDriver
        );
        const poleCode = poleIdentity.driverCode || `#${poleResult.driver_number}`;
        const poleLap = getBestQualifyingLap(poleResult);

        return {
            session,
            lifecycle,
            statusText: 'Completed',
            poleSitter: poleCode,
            poleLap: poleLap || 'N/A',
            poleDriverInitials: poleIdentity.driverInitials || null,
            poleHeadshotUrl: poleIdentity.headshotUrl,
            poleTeam: poleIdentity.team || null,
        };
    } catch (error) {
        console.warn(`[GPScreen] Qualifying highlight unavailable for session ${session.session_key}:`, error);
        return {
            session,
            lifecycle,
            statusText: 'Completed · results pending',
            poleSitter: null,
            poleLap: null,
            poleDriverInitials: null,
            poleHeadshotUrl: null,
            poleTeam: null,
        };
    }
};

const buildRaceHighlight = async (session: Session | null): Promise<RaceHighlight> => {
    if (!session) {
        return {
            session: null,
            lifecycle: 'tbc',
            statusText: 'Not scheduled',
            podium: [],
        };
    }

    const lifecycle = getSessionLifecycle(session);

    if (lifecycle !== 'completed') {
        return {
            session,
            lifecycle,
            statusText: formatLifecycleLabel(session, lifecycle),
            podium: [],
        };
    }

    try {
        const [results, drivers] = await Promise.all([
            getSessionResults(session.session_key),
            getDriversBySession(session.session_key),
        ]);
        const driverMap = new Map(drivers.map(driver => [driver.driver_number, driver]));
        const podium = results
            .filter(
                (entry): entry is SessionResult & { position: 1 | 2 | 3 } =>
                    entry.position === 1 || entry.position === 2 || entry.position === 3
            )
            .sort((a, b) => a.position - b.position)
            .map(entry => {
                const identity = buildDriverHighlightIdentity(
                    driverMap.get(entry.driver_number)
                        ?? drivers.find(driver => String(driver.driver_number) === String(entry.driver_number))
                );
                return {
                    position: entry.position,
                    driverInitials: identity.driverInitials,
                    driverCode: identity.driverCode,
                    headshotUrl: identity.headshotUrl,
                    team: identity.team,
                };
            });

        if (!podium.length) {
            return {
                session,
                lifecycle,
                statusText: 'Completed · results pending',
                podium: [],
            };
        }

        return {
            session,
            lifecycle,
            statusText: 'Completed',
            podium,
        };
    } catch (error) {
        console.warn(`[GPScreen] Race highlight unavailable for session ${session.session_key}:`, error);
        return {
            session,
            lifecycle,
            statusText: 'Completed · results pending',
            podium: [],
        };
    }
};

const buildWeekendHighlights = async (sessions: Session[]): Promise<WeekendHighlights> => {
    const qualifyingSession = selectQualifyingSession(sessions);
    const raceSession = selectRaceSession(sessions);

    const [qualifying, race] = await Promise.all([
        buildQualifyingHighlight(qualifyingSession, raceSession),
        buildRaceHighlight(raceSession),
    ]);

    return { qualifying, race };
};

const getLifecycleBadgeColors = (lifecycle: SessionLifecycle) => {
    if (lifecycle === 'live') {
        return { bg: '#E6F8EE', text: '#12753D' };
    }

    if (lifecycle === 'completed') {
        return { bg: '#EEF1F7', text: '#4D5166' };
    }

    if (lifecycle === 'upcoming') {
        return { bg: semanticColors.dangerSoft, text: semanticColors.dangerStrong };
    }

    return { bg: '#F2F4F8', text: '#697087' };
};

const getPodiumTone = (position: 1 | 2 | 3) => {
    if (position === 1) {
        return {
            border: '#EAC457',
            background: '#31270F',
            badgeBackground: '#FFD76B',
            badgeText: '#4A3500',
            initialsBackground: '#F0CA63',
            initialsText: '#4A3500',
        };
    }

    if (position === 2) {
        return {
            border: '#BFC5D8',
            background: '#242833',
            badgeBackground: '#DFE3EE',
            badgeText: '#2E3240',
            initialsBackground: '#D7DCE8',
            initialsText: '#2E3240',
        };
    }

    return {
        border: '#C88B56',
        background: '#2C2218',
        badgeBackground: '#D9A06E',
        badgeText: '#46270E',
        initialsBackground: '#C88E5C',
        initialsText: '#46270E',
    };
};

const isTestingEvent = (meeting: Meeting, sessions: Session[]): boolean => {
    const meetingText = `${meeting.meeting_name || ''} ${meeting.meeting_official_name || ''}`.toLowerCase();
    if (meetingText.includes('testing') || meetingText.includes('test')) {
        return true;
    }

    const sessionTexts = sessions.map(session =>
        `${session.session_type || ''} ${session.session_name || ''}`.toLowerCase()
    );

    const hasTestingSession = sessionTexts.some(text => text.includes('test'));
    const hasRaceWeekendSession = sessionTexts.some(
        text =>
            text.includes('qualifying') ||
            text.includes('shootout') ||
            text.includes('sprint') ||
            text.includes('race') ||
            text.includes('grand prix')
    );

    return hasTestingSession && !hasRaceWeekendSession;
};

const buildTestingOverview = (sessions: Session[]): TestingOverview => {
    return sessions.reduce<TestingOverview>(
        (accumulator, session) => {
            const lifecycle = getSessionLifecycle(session);
            if (lifecycle === 'completed') {
                accumulator.completed += 1;
            } else if (lifecycle === 'live') {
                accumulator.live += 1;
            } else {
                accumulator.upcoming += 1;
            }
            return accumulator;
        },
        {
            total: sessions.length,
            completed: 0,
            live: 0,
            upcoming: 0,
        }
    );
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
        const testingMeeting = isTestingEvent(meeting, sessions);
        const highlights = testingMeeting ? null : await buildWeekendHighlights(sessions);
        const testingOverview = testingMeeting ? buildTestingOverview(sessions) : null;

        return { meeting, sessions, isTestingMeeting: testingMeeting, testingOverview, highlights };
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

        return [...data.sessions].sort(sortByStartAsc);
    }, [data?.sessions]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading weekend...</Text>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to load weekend</Text>
                <Text style={styles.errorMessage}>{error || 'Meeting not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { meeting, highlights, isTestingMeeting, testingOverview } = data;
    const dateRange = formatDateRange(meeting.date_start, meeting.date_end);
    const qualifyingBadge = highlights ? getLifecycleBadgeColors(highlights.qualifying.lifecycle) : null;
    const raceBadge = highlights ? getLifecycleBadgeColors(highlights.race.lifecycle) : null;
    const podiumDisplay: PodiumEntry[] = (() => {
        if (!highlights?.race.podium.length) return [];
        const order: Array<1 | 2 | 3> = [2, 1, 3];
        const byPosition = new Map(highlights.race.podium.map(entry => [entry.position, entry]));
        return order
            .map(position => byPosition.get(position))
            .filter((entry): entry is PodiumEntry => Boolean(entry));
    })();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroRail} />
                <View style={styles.heroTopRow}>
                    <View style={styles.flagRow}>
                        {meeting.country_flag ? (
                            <Image source={{ uri: meeting.country_flag }} style={styles.flag} />
                        ) : null}
                        <Text style={styles.countryCode}>{meeting.country_code || 'GP'}</Text>
                    </View>
                    <View style={styles.datePill}>
                        <MaterialCommunityIcons name="calendar-range" size={12} color={semanticColors.surface} />
                        <Text style={styles.datePillText}>{dateRange}</Text>
                    </View>
                </View>

                <Text style={styles.heroTitle}>{meeting.meeting_name}</Text>
                <Text style={styles.heroSubtitle}>{meeting.location}, {meeting.country_name}</Text>

                <View style={styles.heroMetaRow}>
                    {meeting.circuit_short_name ? (
                        <View style={styles.heroMetaChip}>
                            <MaterialCommunityIcons name="road-variant" size={12} color="rgba(255,255,255,0.82)" />
                            <Text style={styles.heroMetaText}>{meeting.circuit_short_name}</Text>
                        </View>
                    ) : null}
                    {meeting.circuit_type ? (
                        <View style={styles.heroMetaChip}>
                            <MaterialCommunityIcons name="map-marker-path" size={12} color="rgba(255,255,255,0.82)" />
                            <Text style={styles.heroMetaText}>{meeting.circuit_type}</Text>
                        </View>
                    ) : null}
                    {meeting.gmt_offset ? (
                        <View style={styles.heroMetaChip}>
                            <MaterialCommunityIcons name="clock-outline" size={12} color="rgba(255,255,255,0.82)" />
                            <Text style={styles.heroMetaText}>GMT {meeting.gmt_offset}</Text>
                        </View>
                    ) : null}
                </View>

                {meeting.circuit_image ? (
                    <Image
                        source={{ uri: meeting.circuit_image }}
                        style={styles.heroImage}
                        resizeMode="contain"
                    />
                ) : null}
            </View>

            {isTestingMeeting ? (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Testing Overview</Text>
                        <MaterialCommunityIcons name="flask-outline" size={16} color={semanticColors.textMuted} />
                    </View>

                    <View style={styles.highlightCard}>
                        <View style={styles.highlightHeader}>
                            <Text style={styles.highlightLabel}>Testing Event</Text>
                            <View style={[styles.highlightBadge, { backgroundColor: '#EEF1F7' }]}>
                                <Text style={[styles.highlightBadgeText, { color: '#4D5166' }]}>NO RACE</Text>
                            </View>
                        </View>
                        <Text style={styles.highlightSecondary}>
                            This meeting does not include qualifying or race results.
                        </Text>
                        {testingOverview ? (
                            <View style={styles.testingStatsRow}>
                                <View style={styles.testingStat}>
                                    <Text style={styles.testingStatValue}>{testingOverview.total}</Text>
                                    <Text style={styles.testingStatLabel}>Sessions</Text>
                                </View>
                                <View style={styles.testingStatDivider} />
                                <View style={styles.testingStat}>
                                    <Text style={styles.testingStatValue}>{testingOverview.completed}</Text>
                                    <Text style={styles.testingStatLabel}>Completed</Text>
                                </View>
                                <View style={styles.testingStatDivider} />
                                <View style={styles.testingStat}>
                                    <Text style={styles.testingStatValue}>{testingOverview.live + testingOverview.upcoming}</Text>
                                    <Text style={styles.testingStatLabel}>Remaining</Text>
                                </View>
                            </View>
                        ) : null}
                    </View>
                </>
            ) : highlights ? (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Weekend Highlights</Text>
                        <MaterialCommunityIcons name="star-four-points-outline" size={16} color={semanticColors.textMuted} />
                    </View>

                    <View style={styles.highlightGrid}>
                        <TouchableOpacity
                            activeOpacity={0.88}
                            disabled={!highlights.qualifying.session}
                            onPress={() => highlights.qualifying.session && handleSessionPress(highlights.qualifying.session)}
                            style={styles.highlightCard}
                        >
                            <View style={styles.highlightHeader}>
                                <Text style={styles.highlightLabel}>Qualifying</Text>
                                <View style={[styles.highlightBadge, { backgroundColor: qualifyingBadge?.bg || '#EEF1F7' }]}> 
                                    <Text style={[styles.highlightBadgeText, { color: qualifyingBadge?.text || '#4D5166' }]}>
                                        {highlights.qualifying.lifecycle.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            {highlights.qualifying.poleSitter && highlights.qualifying.poleLap ? (
                                <>
                                    <View style={styles.qualifyingResultRow}>
                                        <View style={styles.qualifyingResultLeft}>
                                            <View style={styles.qualifyingDriverRow}>
                                                {highlights.qualifying.poleHeadshotUrl ? (
                                                    <Image
                                                        source={{ uri: highlights.qualifying.poleHeadshotUrl }}
                                                        style={styles.qualifyingAvatar}
                                                    />
                                                ) : (
                                                    <View style={styles.qualifyingAvatarFallback}>
                                                        <Text style={styles.qualifyingAvatarFallbackText}>
                                                            {highlights.qualifying.poleDriverInitials
                                                                || highlights.qualifying.poleSitter.slice(0, 2)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View style={styles.qualifyingDriverTextBlock}>
                                                    <Text style={styles.qualifyingDriverCode}>
                                                        {highlights.qualifying.poleSitter}
                                                    </Text>
                                                    {highlights.qualifying.poleTeam ? (
                                                        <Text style={styles.qualifyingDriverTeam} numberOfLines={1}>
                                                            {highlights.qualifying.poleTeam}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.qualifyingLapPanel}>
                                            <Text style={styles.qualifyingLapLabel}>Best Lap</Text>
                                            <Text style={styles.qualifyingLapValue}>
                                                {highlights.qualifying.poleLap}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.highlightSecondary}>{highlights.qualifying.statusText}</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.88}
                            disabled={!highlights.race.session}
                            onPress={() => highlights.race.session && handleSessionPress(highlights.race.session)}
                            style={styles.highlightCard}
                        >
                            <View style={styles.highlightHeader}>
                                <Text style={styles.highlightLabel}>Race</Text>
                                <View style={[styles.highlightBadge, { backgroundColor: raceBadge?.bg || '#EEF1F7' }]}> 
                                    <Text style={[styles.highlightBadgeText, { color: raceBadge?.text || '#4D5166' }]}>
                                        {highlights.race.lifecycle.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            {highlights.race.podium.length > 0 ? (
                                <View style={styles.podiumCardsRow}>
                                    {podiumDisplay.map((entry, index) => {
                                        const tone = getPodiumTone(entry.position);
                                        return (
                                            <View
                                                key={`podium-${entry.position}`}
                                                style={[
                                                    styles.podiumCard,
                                                    index < highlights.race.podium.length - 1
                                                        && styles.podiumCardSpacing,
                                                    {
                                                        borderColor: tone.border,
                                                        backgroundColor: tone.background,
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.podiumPositionBadge,
                                                        { backgroundColor: tone.badgeBackground },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.podiumPositionText,
                                                            { color: tone.badgeText },
                                                        ]}
                                                    >
                                                        P{entry.position}
                                                    </Text>
                                                </View>
                                                {entry.headshotUrl ? (
                                                    <Image
                                                        source={{ uri: entry.headshotUrl }}
                                                        style={styles.podiumAvatar}
                                                    />
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.podiumInitialsFallback,
                                                            { backgroundColor: tone.initialsBackground },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.podiumInitialsFallbackText,
                                                                { color: tone.initialsText },
                                                            ]}
                                                        >
                                                            {entry.driverCode.slice(0, 2)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={styles.podiumInitials}>{entry.driverCode}</Text>
                                                <Text style={styles.podiumTeam} numberOfLines={1}>
                                                    {entry.team}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={styles.highlightSecondary}>{highlights.race.statusText}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            ) : null}

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Weekend Schedule</Text>
                <View style={styles.sectionCountPill}>
                    <Text style={styles.sectionCountText}>{sortedSessions.length}</Text>
                </View>
            </View>

            <View>
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
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No sessions available</Text>
                        <Text style={styles.emptySubtitle}>The schedule has not been published yet.</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.backgroundMuted,
    },
    contentContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.backgroundMuted,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
        ...shadows.glow,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroCard: {
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        overflow: 'hidden',
        ...shadows.level3,
    },
    heroRail: {
        position: 'absolute',
        left: spacing.lg,
        top: 0,
        height: 5,
        width: 92,
        borderBottomLeftRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
        backgroundColor: colors.brand.primary,
    },
    heroTopRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    flagRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flag: {
        width: 34,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.32)',
        marginRight: spacing.xs,
    },
    countryCode: {
        color: semanticColors.surface,
        fontSize: typography.size.base,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.wider,
    },
    datePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
    },
    datePillText: {
        marginLeft: spacing.xs,
        color: semanticColors.surface,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.tight,
    },
    heroSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.78)',
    },
    heroMetaRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    heroMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 5,
        marginRight: spacing.xs,
        marginBottom: spacing.xs,
    },
    heroMetaText: {
        marginLeft: 5,
        color: 'rgba(255,255,255,0.9)',
        fontSize: typography.size.xs,
        fontWeight: typography.weight.medium,
    },
    heroImage: {
        width: '100%',
        height: 150,
        opacity: 0.9,
    },
    sectionHeader: {
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sectionCountPill: {
        minWidth: 30,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: semanticColors.borderStrong,
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        alignItems: 'center',
    },
    sectionCountText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    highlightGrid: {
        marginBottom: spacing.xs,
    },
    highlightCard: {
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.level2,
    },
    highlightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    highlightLabel: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    highlightBadge: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
    },
    highlightBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    highlightPrimary: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        marginBottom: 2,
    },
    highlightSecondary: {
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.78)',
    },
    qualifyingResultRow: {
        marginTop: spacing.xxs,
        marginBottom: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    qualifyingResultLeft: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    qualifyingDriverRow: {
        marginTop: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    qualifyingAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: overlays.white20,
        marginRight: spacing.xs,
    },
    qualifyingAvatarFallback: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.xs,
        backgroundColor: overlays.white20,
    },
    qualifyingAvatarFallbackText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.wide,
    },
    qualifyingDriverTextBlock: {
        flexShrink: 1,
    },
    qualifyingDriverCode: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.wide,
    },
    qualifyingDriverTeam: {
        marginTop: 1,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.76)',
    },
    qualifyingResultLabel: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: 'rgba(255,255,255,0.74)',
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    qualifyingLapPanel: {
        minWidth: 112,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: '#58607A',
        backgroundColor: '#171B27',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        alignItems: 'flex-end',
    },
    qualifyingLapLabel: {
        fontSize: typography.size.xs,
        color: '#AEB4CB',
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.semibold,
    },
    qualifyingLapValue: {
        marginTop: 2,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.tight,
    },
    podiumCardsRow: {
        marginTop: spacing.xs,
        flexDirection: 'row',
    },
    podiumCard: {
        flex: 1,
        borderRadius: radius.md,
        borderWidth: 1,
        paddingHorizontal: spacing.xs,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        alignItems: 'center',
    },
    podiumCardSpacing: {
        marginRight: spacing.xs,
    },
    podiumPositionBadge: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        marginBottom: spacing.xs,
    },
    podiumPositionText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.wider,
    },
    podiumAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: overlays.white20,
        marginBottom: spacing.xs,
    },
    podiumInitialsFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    podiumInitialsFallbackText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.black,
    },
    podiumInitials: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        marginBottom: 2,
        letterSpacing: typography.letterSpacing.wide,
    },
    podiumTeam: {
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.76)',
        textAlign: 'center',
    },
    testingStatsRow: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        paddingVertical: spacing.sm,
    },
    testingStat: {
        flex: 1,
        alignItems: 'center',
    },
    testingStatValue: {
        fontSize: typography.size.xl,
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
    testingStatLabel: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.72)',
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    testingStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: overlays.white20,
    },
    emptyCard: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.border,
        backgroundColor: semanticColors.surface,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textAlign: 'center',
    },
});
