import React, { useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../theme/tokens';
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
        const upcoming = meetings.filter(
            meeting => new Date(meeting.date_start).getTime() > Date.now()
        ).length;
        return {
            total: meetings.length,
            upcoming,
        };
    }, [meetings]);

    const renderHero = () => (
        <View style={styles.heroCard}>
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
            <View>
                <Text style={styles.heroSubtitle}>Formula 1 · Season {seasonYear}</Text>
                <Text style={styles.heroTitle}>Grand Prix Calendar</Text>
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
            </View>
        </View>
    );

    const renderScreenHeader = () => (
        <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Races</Text>
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
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: tabBarHeight + 28 },
                ]}
                ListHeaderComponent={renderHero}
            />
        </SafeAreaView>
    );
};

export default SessionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    screenHeader: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xxs,
    },
    screenTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listContent: {
        padding: spacing.md,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: semanticColors.background,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.lg,
        color: semanticColors.textSecondary,
    },
    errorText: {
        fontSize: typography.size.lg,
        color: semanticColors.danger,
    },
    retryButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        backgroundColor: semanticColors.danger,
        borderRadius: radius.sm,
    },
    retryText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
    heroCard: {
        backgroundColor: semanticColors.textPrimary,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    yearRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    yearChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white12,
        marginHorizontal: spacing.xxs,
        marginBottom: spacing.xs,
    },
    yearChipActive: {
        backgroundColor: semanticColors.surface,
    },
    yearChipText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    yearChipTextActive: {
        color: semanticColors.textPrimary,
    },
    heroTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginTop: spacing.xs,
    },
    heroSubtitle: {
        fontSize: typography.size.base,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: typography.letterSpacing.wide,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
        backgroundColor: overlays.white08,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
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
});
