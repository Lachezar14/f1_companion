import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getPracticeSessionDetail } from '../../../../backend/service/openf1Service';
import type { PracticeSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { calculateAvgLapTimePerCompound, calculateTypicalLapDuration } from '../../../../utils/lap';
import { formatLapTime } from '../../../../shared/time';
import { getCompoundName } from '../../../../utils/tyre';
import { getTeamColorHex } from '../../../../utils/driver';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
    initialViewMode?: PaceViewMode;
    initialCompound?: string;
};

type PaceViewMode = 'drivers' | 'teams';

type DriverCompoundStat = {
    driverName: string;
    driverNumber: number;
    teamName: string;
    lapCount: number;
    avgTime: number;
};

type TeamCompoundStat = {
    teamName: string;
    avgTime: number;
    color?: string | null;
};

const MIN_PACE_LAP_THRESHOLD = 3;
const PRACTICE_PACE_THRESHOLD_FACTOR = 1.07;
const EXPLAIN_META: Record<PaceViewMode, { subtitle: string; bullets: string[] }> = {
    drivers: {
        subtitle: 'Complete driver pace tables per tyre compound.',
        bullets: [
            'Uses clean-lap averages per driver on each compound.',
            'Pit-out laps are excluded from the pace sample.',
            `Only compounds with at least ${MIN_PACE_LAP_THRESHOLD} representative laps are ranked.`,
        ],
    },
    teams: {
        subtitle: 'Complete team pace tables per tyre compound.',
        bullets: [
            'Team pace combines both drivers with lap-weighted averaging.',
            'Pit-out laps are excluded from the pace sample.',
            `Only compounds with at least ${MIN_PACE_LAP_THRESHOLD} representative laps are ranked.`,
        ],
    },
};

const PracticePaceInsightsScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName, initialViewMode, initialCompound } = route.params;
    const [viewMode, setViewMode] = useState<PaceViewMode>(
        initialViewMode === 'teams' ? 'teams' : 'drivers'
    );
    const [selectedCompound, setSelectedCompound] = useState<string | null>(null);

    const loadPracticeData = useCallback(async (): Promise<PracticeSessionDetail> => {
        return getPracticeSessionDetail(sessionKey);
    }, [sessionKey]);

    const { data, loading, error, refreshing, reload, refresh } = useServiceRequest<PracticeSessionDetail>(
        loadPracticeData,
        [loadPracticeData]
    );

    const driverEntries = data?.drivers ?? [];

    const compoundOptions = useMemo(() => {
        const set = new Set<string>();
        driverEntries.forEach(entry => {
            entry.stints.forEach(stint => {
                if (!stint.compound) return;
                set.add(stint.compound.toUpperCase());
            });
        });
        return Array.from(set);
    }, [driverEntries]);

    useEffect(() => {
        if (!compoundOptions.length) {
            setSelectedCompound(null);
            return;
        }
        if (initialCompound && compoundOptions.includes(initialCompound)) {
            setSelectedCompound(initialCompound);
            return;
        }
        setSelectedCompound(prev =>
            prev && compoundOptions.includes(prev) ? prev : compoundOptions[0]
        );
    }, [compoundOptions, initialCompound]);

    const driverLapThresholds = useMemo(() => {
        const map = new Map<number, number | null>();
        driverEntries.forEach(entry => {
            const typicalLap = calculateTypicalLapDuration(entry.laps);
            map.set(
                entry.driverNumber,
                typicalLap ? typicalLap * PRACTICE_PACE_THRESHOLD_FACTOR : null
            );
        });
        return map;
    }, [driverEntries]);

    const driverPaceByCompound = useMemo(() => {
        const map = new Map<string, DriverCompoundStat[]>();

        driverEntries.forEach(entry => {
            const lapThreshold = driverLapThresholds.get(entry.driverNumber) ?? null;
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                lapThreshold: lapThreshold ?? undefined,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < MIN_PACE_LAP_THRESHOLD) return;
                const compound = stat.compound.toUpperCase();
                const list = map.get(compound) ?? [];
                list.push({
                    driverName: entry.driver.name,
                    driverNumber: entry.driverNumber,
                    teamName: entry.driver.team,
                    lapCount: stat.lapCount,
                    avgTime: stat.avgTime,
                });
                map.set(compound, list);
            });
        });

        compoundOptions.forEach(compound => {
            if (!map.has(compound)) {
                map.set(compound, []);
            }
        });

        map.forEach((list, compound) => {
            list.sort((a, b) => a.avgTime - b.avgTime);
            map.set(compound, list);
        });

        return map;
    }, [compoundOptions, driverEntries, driverLapThresholds]);

    const teamPaceByCompound = useMemo(() => {
        const compoundMap = new Map<
            string,
            Map<string, { total: number; count: number; color?: string | null }>
        >();

        driverEntries.forEach(entry => {
            const lapThreshold = driverLapThresholds.get(entry.driverNumber) ?? null;
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                lapThreshold: lapThreshold ?? undefined,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < MIN_PACE_LAP_THRESHOLD) return;
                const compound = stat.compound.toUpperCase();
                const teamName = entry.driver.team;
                const totalTime = stat.avgTime * stat.lapCount;
                const compoundTeams = compoundMap.get(compound) ?? new Map();
                const agg = compoundTeams.get(teamName) ?? {
                    total: 0,
                    count: 0,
                    color: entry.driver.teamColor,
                };
                compoundTeams.set(teamName, {
                    total: agg.total + totalTime,
                    count: agg.count + stat.lapCount,
                    color: agg.color ?? entry.driver.teamColor,
                });
                compoundMap.set(compound, compoundTeams);
            });
        });

        const result = new Map<string, TeamCompoundStat[]>();
        compoundOptions.forEach(compound => {
            const aggregate = compoundMap.get(compound);
            if (!aggregate) {
                result.set(compound, []);
                return;
            }
            const teams: TeamCompoundStat[] = [];
            aggregate.forEach((value, teamName) => {
                if (!value.count) return;
                const avg = value.total / value.count;
                if (!Number.isFinite(avg)) return;
                teams.push({
                    teamName,
                    avgTime: avg,
                    color: value.color,
                });
            });
            teams.sort((a, b) => a.avgTime - b.avgTime);
            result.set(compound, teams);
        });

        return result;
    }, [compoundOptions, driverEntries, driverLapThresholds]);

    const selectedCompoundName = selectedCompound ? getCompoundName(selectedCompound) : null;
    const explainMeta = EXPLAIN_META[viewMode];
    const driverRows =
        selectedCompound && driverPaceByCompound.has(selectedCompound)
            ? driverPaceByCompound.get(selectedCompound) ?? []
            : [];
    const teamRows =
        selectedCompound && teamPaceByCompound.has(selectedCompound)
            ? teamPaceByCompound.get(selectedCompound) ?? []
            : [];

    const formatPace = (value?: number | null) =>
        typeof value === 'number' && value > 0 ? formatLapTime(value) : '—';

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading pace insights...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
            }
        >
            <View style={styles.headerCard}>
                <Text style={styles.headerOverline}>{meetingName || data?.location}</Text>
                <Text style={styles.headerTitle}>{sessionName}</Text>
                <Text style={styles.headerSubtitle}>
                    Driver and team pace by compound (complete ranking)
                </Text>
            </View>

            <View style={styles.insightModeCard}>
                <Text style={styles.insightModeLabel}>Pace View</Text>
                <View style={styles.insightModeOptions}>
                    <TouchableOpacity
                        style={[styles.filterChip, viewMode === 'teams' && styles.filterChipActive]}
                        onPress={() => setViewMode('teams')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                viewMode === 'teams' && styles.filterChipLabelActive,
                            ]}
                        >
                            Teams
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, viewMode === 'drivers' && styles.filterChipActive]}
                        onPress={() => setViewMode('drivers')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                viewMode === 'drivers' && styles.filterChipLabelActive,
                            ]}
                        >
                            Drivers
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.explainCard}>
                <Text style={styles.cardOverline}>How To Read This</Text>
                <Text style={styles.cardTitle}>{explainMeta.subtitle}</Text>
                {explainMeta.bullets.map(line => (
                    <Text key={line} style={styles.cardBody}>
                        {line}
                    </Text>
                ))}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Average Pace by Compound</Text>
                    <Text style={styles.listSubtitle}>
                        {selectedCompoundName
                            ? viewMode === 'teams'
                                ? `All teams on ${selectedCompoundName}`
                                : `All drivers on ${selectedCompoundName}`
                            : 'Select a compound'}
                    </Text>
                </View>

                {compoundOptions.length ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundOptions.map(compound => {
                            const active = compound === selectedCompound;
                            return (
                                <TouchableOpacity
                                    key={`pace-compound-${compound}`}
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => setSelectedCompound(compound)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            active && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {getCompoundName(compound)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}

                {selectedCompound && (viewMode === 'drivers' ? driverRows.length : teamRows.length) ? (
                    viewMode === 'drivers' ? (
                        driverRows.map((row, index) => (
                            <View key={`${selectedCompound}-${row.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{row.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {row.teamName} • {row.lapCount} {row.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(row.avgTime)}</Text>
                            </View>
                        ))
                    ) : (
                        teamRows.map((row, index) => (
                            <View key={`${selectedCompound}-${row.teamName}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.teamDot,
                                        { backgroundColor: getTeamColorHex(row.color) },
                                    ]}
                                />
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>{row.teamName}</Text>
                                </View>
                                <Text style={styles.listValue}>{formatPace(row.avgTime)}</Text>
                            </View>
                        ))
                    )
                ) : (
                    <Text style={styles.noData}>
                        {selectedCompoundName
                            ? viewMode === 'teams'
                                ? `No representative pace on ${selectedCompoundName}`
                                : `No clean laps for ${selectedCompoundName}`
                            : viewMode === 'teams'
                                ? 'No team pace data yet'
                                : 'No driver pace data yet'}
                    </Text>
                )}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default PracticePaceInsightsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: semanticColors.backgroundMuted,
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.sm,
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
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
    headerCard: {
        margin: spacing.md,
        borderRadius: radius.xl,
        padding: spacing.lg,
        backgroundColor: semanticColors.surfaceInverse,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    headerOverline: {
        color: 'rgba(255,255,255,0.76)',
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wide,
    },
    headerTitle: {
        marginTop: spacing.xxs,
        color: semanticColors.surface,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
    },
    headerSubtitle: {
        marginTop: spacing.xs,
        color: 'rgba(255,255,255,0.76)',
        fontSize: typography.size.sm,
    },
    insightModeCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    insightModeLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    insightModeOptions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    explainCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    cardOverline: {
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },
    cardTitle: {
        marginBottom: spacing.xs,
        fontSize: typography.size.lg,
        color: semanticColors.textPrimary,
        fontWeight: typography.weight.bold,
    },
    cardBody: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        lineHeight: 20,
    },
    listCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    listHeader: {
        marginBottom: spacing.sm,
    },
    listTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSubtitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    filterScroll: {
        marginBottom: spacing.xs,
    },
    filterContent: {
        paddingVertical: spacing.xxs,
    },
    filterChip: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#D5DAE7',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginRight: spacing.xs,
        backgroundColor: semanticColors.surface,
    },
    filterChipActive: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    filterChipLabel: {
        fontSize: typography.size.sm,
        color: '#6E738B',
        fontWeight: typography.weight.semibold,
    },
    filterChipLabelActive: {
        color: semanticColors.surface,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.borderMuted,
    },
    teamDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.sm,
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: radius.lg,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    rankText: {
        fontWeight: typography.weight.bold,
        color: '#5C6BFF',
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listMeta: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        marginTop: 2,
    },
    listValue: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginLeft: spacing.sm,
    },
    noData: {
        textAlign: 'center',
        color: '#8A8FA6',
        fontSize: typography.size.sm,
        paddingVertical: spacing.sm,
    },
    refreshHint: {
        paddingVertical: spacing.xl,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
