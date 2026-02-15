import React, { useMemo, useState } from 'react';
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
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { getMeetingsByYear } from '../../backend/service/openf1Service';
import type { Meeting } from '../../backend/types';
import GPCard from '../component/gp/GPCard';
import { AVAILABLE_MEETING_YEARS, DEFAULT_MEETING_YEAR } from '../config/appConfig';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const SessionsScreen = () => {
    const [seasonYear, setSeasonYear] = useState(DEFAULT_MEETING_YEAR);
    const tabBarHeight = useBottomTabBarHeight();
    const { data, loading, error, reload } = useServiceRequest<Meeting[]>(
        () => getMeetingsByYear(seasonYear),
        [seasonYear]
    );

    const meetings = data ?? [];

    const seasonSummary = useMemo(() => {
        const now = Date.now();
        const upcoming = meetings.filter(
            meeting => new Date(meeting.date_start).getTime() > now
        ).length;
        const completed = meetings.filter(
            meeting => new Date(meeting.date_end).getTime() < now
        ).length;
        const live = Math.max(meetings.length - upcoming - completed, 0);

        return {
            total: meetings.length,
            upcoming,
            completed,
            live,
        };
    }, [meetings]);

    const renderHero = () => (
        <View style={styles.heroCard}>
            <View style={styles.heroRail} />
            <View style={styles.heroTopRow}>
                <Text style={styles.heroEyebrow}>RACE COMPANION</Text>
                <View style={styles.seasonBadge}>
                    <View style={styles.seasonBadgeDot} />
                    <Text style={styles.seasonBadgeText}>SEASON {seasonYear}</Text>
                </View>
            </View>
            <Text style={styles.heroTitle}>Race Weekend Calendar</Text>
            <Text style={styles.heroSubtitle}>
                Choose a Grand Prix and drill into every session.
            </Text>

            <View style={styles.yearRow}>
                {AVAILABLE_MEETING_YEARS.map(year => (
                    <TouchableOpacity
                        key={year}
                        onPress={() => setSeasonYear(year)}
                        activeOpacity={0.85}
                        style={[
                            styles.yearChip,
                            seasonYear === year && styles.yearChipActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.yearChipText,
                                seasonYear === year && styles.yearChipTextActive,
                            ]}
                        >
                            {year}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{seasonSummary.total}</Text>
                    <Text style={styles.heroStatLabel}>Events</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{seasonSummary.upcoming}</Text>
                    <Text style={styles.heroStatLabel}>Upcoming</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>
                        {seasonSummary.live > 0 ? seasonSummary.live : seasonSummary.completed}
                    </Text>
                    <Text style={styles.heroStatLabel}>
                        {seasonSummary.live > 0 ? 'Live' : 'Completed'}
                    </Text>
                </View>
            </View>
        </View>
    );

    const renderScreenHeader = () => (
        <View style={styles.screenHeader}>
            <Text style={styles.screenLabel}>SEASON HUB</Text>
            <Text style={styles.screenTitle}>Meetings</Text>
        </View>
    );

    const renderListHeader = () => (
        <View>
            {renderHero()}
            <View style={styles.listSectionHeader}>
                <Text style={styles.listSectionTitle}>Grand Prix Weekends</Text>
                <View style={styles.listSectionCount}>
                    <Text style={styles.listSectionCountText}>{seasonSummary.total}</Text>
                </View>
            </View>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No meetings available</Text>
            <Text style={styles.emptySubtitle}>
                Try another season from the selector above.
            </Text>
        </View>
    );

    const renderMeeting = ({ item }: { item: Meeting }) => <GPCard meeting={item} />;

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={semanticColors.danger} />
                    <Text style={styles.loadingText}>Loading calendar…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={reload}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderScreenHeader()}
            <FlatList
                data={meetings}
                keyExtractor={item => item.meeting_key.toString()}
                renderItem={renderMeeting}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: tabBarHeight + 28 },
                ]}
                ListHeaderComponent={renderListHeader}
                ListEmptyComponent={renderEmptyState}
            />
        </SafeAreaView>
    );
};

export default SessionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.backgroundMuted,
    },
    screenHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    screenLabel: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.widest,
        marginBottom: spacing.xxs,
    },
    screenTitle: {
        fontSize: typography.size.display,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.tight,
        color: semanticColors.textPrimary,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: semanticColors.backgroundMuted,
        paddingHorizontal: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
    },
    errorText: {
        textAlign: 'center',
        fontSize: typography.size.base,
        color: semanticColors.danger,
    },
    retryButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        backgroundColor: semanticColors.danger,
        borderRadius: radius.sm,
        ...shadows.glow,
    },
    retryText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroCard: {
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
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
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroEyebrow: {
        color: 'rgba(255,255,255,0.74)',
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.widest,
        fontWeight: typography.weight.semibold,
    },
    seasonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
    },
    seasonBadgeDot: {
        width: 7,
        height: 7,
        borderRadius: radius.pill,
        backgroundColor: colors.flags.green,
        marginRight: spacing.xs,
    },
    seasonBadgeText: {
        color: semanticColors.surface,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    yearRow: {
        flexDirection: 'row',
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    yearChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white08,
        borderWidth: 1,
        borderColor: overlays.white12,
        marginHorizontal: spacing.xxs,
        marginBottom: spacing.xs,
    },
    yearChipActive: {
        backgroundColor: semanticColors.danger,
        borderColor: semanticColors.danger,
    },
    yearChipText: {
        color: 'rgba(255,255,255,0.78)',
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wider,
    },
    yearChipTextActive: {
        color: semanticColors.surface,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.tight,
        color: semanticColors.surface,
        marginTop: spacing.xxs,
    },
    heroSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: typography.letterSpacing.wide,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
        backgroundColor: overlays.white10,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        paddingVertical: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
    },
    heroStatLabel: {
        fontSize: typography.size.sm,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: typography.letterSpacing.wider,
        marginTop: spacing.xxs,
    },
    heroDivider: {
        width: 1,
        height: 36,
        backgroundColor: overlays.white20,
    },
    listSectionHeader: {
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    listSectionTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSectionCount: {
        minWidth: 32,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        backgroundColor: semanticColors.surface,
        borderWidth: 1,
        borderColor: semanticColors.borderStrong,
        alignItems: 'center',
    },
    listSectionCountText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    emptyState: {
        marginTop: spacing.xl,
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.border,
        backgroundColor: semanticColors.surface,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        fontSize: typography.size.sm,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
