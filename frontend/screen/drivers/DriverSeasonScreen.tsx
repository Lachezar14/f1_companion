import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../theme/tokens';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getDriverSeasonStats } from '../../../backend/service/openf1Service';
import type { DriverSeasonSessionSummary, DriverSeasonStats } from '../../../backend/types';
import { DEFAULT_SEASON_YEAR } from '../../config/appConfig';
import { Ionicons } from '@expo/vector-icons';

type RouteParams = {
    driverNumber: number;
    year?: number;
    driverName?: string;
    teamName?: string;
    teamColor?: string;
    headshotUrl?: string;
};

interface DriverSeasonState {
    stats: DriverSeasonStats | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const DriverSeasonScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        year,
        driverName,
        teamName,
        teamColor,
        headshotUrl,
    } = route.params;
    const seasonYear = year ?? DEFAULT_SEASON_YEAR;

    const [state, setState] = useState<DriverSeasonState>({
        stats: null,
        loading: true,
        refreshing: false,
        error: null,
    });
    const [expandedSections, setExpandedSections] = useState({
        race: true,
        qualifying: true,
    });

    const driverContext = useMemo(
        () => ({
            name: driverName,
            team: teamName,
            teamColor,
            headshotUrl,
        }),
        [driverName, teamName, teamColor, headshotUrl]
    );

    const fetchStats = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const stats = await getDriverSeasonStats(driverNumber, seasonYear, driverContext);
                if (!stats) {
                    setState({
                        stats: null,
                        loading: false,
                        refreshing: false,
                        error: 'No stats available for this driver',
                    });
                    return;
                }

                setState({
                    stats,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    stats: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load stats',
                });
            }
        },
        [driverNumber, seasonYear, driverContext]
    );

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleRefresh = useCallback(() => fetchStats(true), [fetchStats]);

    const formatSessionDate = useCallback((iso: string | undefined) => {
        if (!iso) return 'Date TBC';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return 'Date TBC';
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, []);

    const renderSessionCard = (summary: DriverSeasonSessionSummary) => {
        const isRace = summary.sessionType === 'Race';
        const badgeStyle = isRace ? styles.raceBadge : styles.qualiBadge;
        const badgeTextStyle = isRace ? styles.raceBadgeText : styles.qualiBadgeText;

        const resultValue = summary.position ? `P${summary.position}` : summary.status ?? '-';

        const stats = [
            {
                label: 'Laps',
                value:
                    typeof summary.laps === 'number' ? summary.laps.toString() : summary.laps ?? '-',
            },
            { label: 'Time', value: summary.duration ?? '-' },
            {
                label: isRace ? 'Gap' : 'Gap to Pole',
                value: summary.gapToLeader ?? '-',
            },
        ];

        return (
            <View key={summary.sessionKey} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionHeaderText}>
                        <Text style={styles.sessionName}>{summary.sessionName}</Text>
                        <Text style={styles.sessionMeta}>
                            {summary.circuit} · {summary.countryName}
                        </Text>
                        <Text style={styles.sessionDate}>{formatSessionDate(summary.dateStart)}</Text>
                    </View>
                    <View style={[styles.sessionBadge, badgeStyle]}>
                        <Text style={[styles.sessionBadgeText, badgeTextStyle]}>
                            {summary.sessionType}
                        </Text>
                    </View>
                </View>

                <View style={styles.resultRow}>
                    <View style={[styles.resultChip, styles.resultChipSpacing]}>
                        <Text style={styles.resultLabel}>Result</Text>
                        <Text style={styles.resultValue}>{resultValue}</Text>
                    </View>
                    <View style={styles.resultChip}>
                        <Text style={styles.resultLabel}>Location</Text>
                        <Text style={styles.resultValue}>{summary.location || '—'}</Text>
                    </View>
                </View>

                <View style={styles.sessionStatsRow}>
                    {stats.map((stat, index) => (
                        <View
                            key={stat.label}
                            style={[
                                styles.sessionStat,
                                index < stats.length - 1 && styles.sessionStatSpacing,
                            ]}
                        >
                            <Text style={styles.sessionStatLabel}>{stat.label}</Text>
                            <Text style={styles.sessionStatValue}>{stat.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const toggleSection = (key: 'race' | 'qualifying') => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const renderSessionsSection = (
        title: string,
        data: DriverSeasonSessionSummary[],
        variant: 'Race' | 'Qualifying',
        keyName: 'race' | 'qualifying'
    ) => {
        const expanded = expandedSections[keyName];
        return (
            <View style={styles.section} key={title}>
                <TouchableOpacity
                    style={styles.sectionHeaderRow}
                    onPress={() => toggleSection(keyName)}
                    activeOpacity={0.82}
                >
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={semanticColors.textMuted}
                    />
                </TouchableOpacity>
                {expanded ? (
                    data.length ? (
                        data.map(renderSessionCard)
                    ) : (
                        <Text style={styles.emptySectionText}>
                            No {variant.toLowerCase()} sessions recorded.
                        </Text>
                    )
                ) : null}
            </View>
        );
    };

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading driver stats...</Text>
            </View>
        );
    }

    if (state.error || !state.stats) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const { driver, season, totals, sessions } = state.stats;
    const teamColorHex = driver.teamColor ? `#${driver.teamColor}` : semanticColors.textPrimary;

    const heroStats = [
        { label: 'Wins', value: totals.wins },
        { label: 'Podiums', value: totals.podiums },
        { label: 'Race Starts', value: totals.races },
    ];

    const metricCards = [
        {
            label: 'Avg Race Pos',
            value: totals.averageRacePosition != null ? totals.averageRacePosition.toFixed(2) : '-',
        },
        {
            label: 'Avg Quali Pos',
            value:
                totals.averageQualifyingPosition != null
                    ? totals.averageQualifyingPosition.toFixed(2)
                    : '-',
        },
        {
            label: 'Best Race',
            value: totals.bestRaceResult != null ? `P${totals.bestRaceResult}` : '-',
        },
        {
            label: 'Best Quali',
            value: totals.bestQualifyingResult != null ? `P${totals.bestQualifyingResult}` : '-',
        },
        { label: 'Quali Sessions', value: totals.qualifyingSessions },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor={semanticColors.danger}
                />
            }
        >
            <View style={[styles.heroCard, { backgroundColor: teamColorHex }]}>
                <View style={styles.heroRow}>
                    <View style={styles.heroTextBlock}>
                        <Text style={styles.heroSubtitle}>Season {season}</Text>
                        <Text style={styles.heroName}>{driver.name}</Text>
                        <Text style={styles.heroTeam}>{driver.team}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>#{driver.number}</Text>
                            </View>
                            <View style={[styles.heroChip, styles.heroChipMuted]}>
                                <Text style={[styles.heroChipText, styles.heroChipTextMuted]}>
                                    {totals.races} Starts
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroAvatar}>
                        {driver.headshotUrl ? (
                            <Image source={{ uri: driver.headshotUrl }} style={styles.heroImage} />
                        ) : (
                            <Text style={styles.heroInitials}>{driver.name[0]}</Text>
                        )}
                    </View>
                </View>
                <View style={styles.heroStatRow}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.metricsSection}>
                {metricCards.map(card => (
                    <View key={card.label} style={styles.metricCard}>
                        <Text style={styles.metricLabel}>{card.label}</Text>
                        <Text style={styles.metricValue}>{card.value}</Text>
                    </View>
                ))}
            </View>

            {renderSessionsSection('Race Results', sessions.races, 'Race', 'race')}
            {renderSessionsSection('Qualifying Results', sessions.qualifying, 'Qualifying', 'qualifying')}
        </ScrollView>
    );
};

export default DriverSeasonScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
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
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
    },
    errorMessage: {
        marginTop: spacing.xs,
        color: semanticColors.textMuted,
        textAlign: 'center',
    },
    heroCard: {
        backgroundColor: semanticColors.textPrimary,
        margin: spacing.md,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroTextBlock: {
        flex: 1,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.heavy,
        color: semanticColors.surface,
        marginTop: spacing.xs,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xxs,
        fontSize: typography.size.base,
    },
    heroChipRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    heroChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white16,
        marginRight: spacing.sm,
    },
    heroChipMuted: {
        backgroundColor: overlays.white08,
    },
    heroChipText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroChipTextMuted: {
        color: 'rgba(255,255,255,0.85)',
        fontWeight: typography.weight.semibold,
    },
    heroAvatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        marginLeft: spacing.md,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroInitials: {
        color: semanticColors.surface,
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.heavy,
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: spacing.lg,
        backgroundColor: overlays.black15,
        borderRadius: radius.xl,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginTop: spacing.xxs,
    },
    metricsSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.xs,
    },
    metricCard: {
        width: '48%',
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        margin: '1%',
        borderWidth: 1,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    metricLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    metricValue: {
        marginTop: spacing.xs,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    section: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.xl,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.03,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: 0,
    },
    emptySectionText: {
        color: semanticColors.textMuted,
        fontStyle: 'italic',
    },
    sessionCard: {
        backgroundColor: '#F9F9FB',
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: '#ECECEC',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    sessionHeaderText: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    sessionName: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    sessionMeta: {
        marginTop: spacing.xxs,
        color: semanticColors.textMuted,
    },
    sessionDate: {
        marginTop: 2,
        color: semanticColors.textMuted,
        fontSize: typography.size.sm,
    },
    sessionBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.md,
    },
    raceBadge: {
        backgroundColor: overlays.brand12,
    },
    qualiBadge: {
        backgroundColor: overlays.cobalt12,
    },
    sessionBadgeText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
    },
    raceBadgeText: {
        color: semanticColors.danger,
    },
    qualiBadgeText: {
        color: colors.accents.cobalt,
    },
    resultRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    resultChip: {
        flex: 1,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: semanticColors.border,
    },
    resultChipSpacing: {
        marginRight: spacing.xs,
    },
    resultLabel: {
        fontSize: typography.size.xs,
        color: '#8D8D8D',
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
    },
    resultValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sessionStatsRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    sessionStat: {
        flex: 1,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: semanticColors.border,
    },
    sessionStatSpacing: {
        marginRight: spacing.sm,
    },
    sessionStatLabel: {
        fontSize: typography.size.xs,
        color: '#8C8C8C',
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    sessionStatValue: {
        marginTop: spacing.xs,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
});
