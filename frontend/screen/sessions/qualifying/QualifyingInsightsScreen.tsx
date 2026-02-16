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
import { getQualifyingSessionDetail } from '../../../../backend/service/openf1Service';
import type { QualifyingSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { formatLapTime } from '../../../../shared/time';

type QualifyingInsightDetailType = 'gains' | 'idealLap' | 'sectorTimes';
type SectorFilter = 's1' | 's2' | 's3';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
    detailType: QualifyingInsightDetailType;
    initialFilter?: string;
};

type SectorRankingRow = {
    driverNumber: number;
    driverName: string;
    teamName: string;
    time: number;
};

const DETAIL_META: Record<
    QualifyingInsightDetailType,
    { title: string; subtitle: string; bullets: string[] }
> = {
    gains: {
        title: 'Biggest Gains',
        subtitle: 'Q1 baseline to best lap improvement ranking.',
        bullets: [
            'Improvement = Q1 lap minus best lap (larger positive is better).',
            'Q1→Q2 and Q2→Q3 deltas show phase-on-phase progression.',
            'Rows include all drivers with available phase timing.',
        ],
    },
    idealLap: {
        title: 'Ideal Lap Potential',
        subtitle: 'Best theoretical laps from sector combinations.',
        bullets: [
            'Ideal lap = best S1 + best S2 + best S3 for each driver.',
            'Potential gain = best recorded lap minus ideal lap.',
            'Lower ideal lap ranks higher; larger potential gain indicates more headroom.',
        ],
    },
    sectorTimes: {
        title: 'Sector Times',
        subtitle: 'Complete rankings per sector.',
        bullets: [
            'Filter by sector to compare all drivers on that segment.',
            'Each row uses the driver’s best valid time in the selected sector.',
            'Lower time is better.',
        ],
    },
};

const buildSectorRankings = (driverEntries: QualifyingSessionDetail['drivers']) => {
    const rankings: Record<SectorFilter, SectorRankingRow[]> = {
        s1: [],
        s2: [],
        s3: [],
    };

    driverEntries.forEach(entry => {
        let bestS1: number | null = null;
        let bestS2: number | null = null;
        let bestS3: number | null = null;

        entry.laps.forEach(lap => {
            if (typeof lap.duration_sector_1 === 'number' && lap.duration_sector_1 > 0) {
                bestS1 =
                    bestS1 == null
                        ? lap.duration_sector_1
                        : Math.min(bestS1, lap.duration_sector_1);
            }
            if (typeof lap.duration_sector_2 === 'number' && lap.duration_sector_2 > 0) {
                bestS2 =
                    bestS2 == null
                        ? lap.duration_sector_2
                        : Math.min(bestS2, lap.duration_sector_2);
            }
            if (typeof lap.duration_sector_3 === 'number' && lap.duration_sector_3 > 0) {
                bestS3 =
                    bestS3 == null
                        ? lap.duration_sector_3
                        : Math.min(bestS3, lap.duration_sector_3);
            }
        });

        if (bestS1 != null) {
            rankings.s1.push({
                driverNumber: entry.driverNumber,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                time: bestS1,
            });
        }
        if (bestS2 != null) {
            rankings.s2.push({
                driverNumber: entry.driverNumber,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                time: bestS2,
            });
        }
        if (bestS3 != null) {
            rankings.s3.push({
                driverNumber: entry.driverNumber,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                time: bestS3,
            });
        }
    });

    rankings.s1.sort((a, b) => a.time - b.time);
    rankings.s2.sort((a, b) => a.time - b.time);
    rankings.s3.sort((a, b) => a.time - b.time);
    return rankings;
};

const formatSignedDelta = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(3)}s`;
};

const formatGainDelta = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    if (value > 0) return `-${value.toFixed(3)}s`;
    if (value < 0) return `+${Math.abs(value).toFixed(3)}s`;
    return '0.000s';
};

const formatLapValue = (value?: number | null) =>
    typeof value === 'number' && value > 0 ? formatLapTime(value) : '—';

const formatSectorTime = (value?: number) =>
    typeof value === 'number' && value > 0 ? `${value.toFixed(3)}s` : '—';

const QualifyingInsightsScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName, detailType, initialFilter } = route.params;
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<SectorFilter>('s1');

    const loadQualifyingData = useCallback(async (): Promise<QualifyingSessionDetail> => {
        return getQualifyingSessionDetail(sessionKey);
    }, [sessionKey]);

    const { data, loading, error, refreshing, reload, refresh } = useServiceRequest<QualifyingSessionDetail>(
        loadQualifyingData,
        [loadQualifyingData]
    );

    useEffect(() => {
        if (detailType !== 'sectorTimes') return;
        if (initialFilter === 's1' || initialFilter === 's2' || initialFilter === 's3') {
            setSelectedSectorFilter(initialFilter);
            return;
        }
        setSelectedSectorFilter('s1');
    }, [detailType, initialFilter]);

    const improvementInsights = data?.insights.improvementIndex.drivers ?? [];
    const idealLapInsights = data?.insights.sectorKings.idealLaps ?? [];
    const sectorRankings = useMemo(() => buildSectorRankings(data?.drivers ?? []), [data?.drivers]);
    const sectorLabel: Record<SectorFilter, string> = {
        s1: 'Sector 1',
        s2: 'Sector 2',
        s3: 'Sector 3',
    };

    const rowsCount = useMemo(() => {
        if (detailType === 'gains') return improvementInsights.length;
        if (detailType === 'idealLap') return idealLapInsights.length;
        return sectorRankings[selectedSectorFilter].length;
    }, [detailType, idealLapInsights.length, improvementInsights.length, sectorRankings, selectedSectorFilter]);

    const heroDate = data?.date_start
        ? new Date(data.date_start).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
          })
        : null;
    const meta = DETAIL_META[detailType];

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading insights...</Text>
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
            <View style={styles.heroCard}>
                <Text style={styles.heroSubtitle}>{meetingName || data?.location || 'Qualifying'}</Text>
                <Text style={styles.heroTitle}>{meta.title}</Text>
                <Text style={styles.heroDetail}>{sessionName}</Text>
                {heroDate ? <Text style={styles.heroDate}>{heroDate}</Text> : null}
                <View style={styles.heroStatsRow}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{rowsCount}</Text>
                        <Text style={styles.heroStatLabel}>Rows</Text>
                    </View>
                </View>
            </View>

            <View style={styles.explainCard}>
                <Text style={styles.cardOverline}>How To Read This</Text>
                <Text style={styles.cardTitle}>{meta.subtitle}</Text>
                {meta.bullets.map(line => (
                    <Text key={line} style={styles.cardBody}>
                        {line}
                    </Text>
                ))}
            </View>

            <View style={styles.listCard}>
                <Text style={styles.listTitle}>
                    {detailType === 'gains'
                        ? 'Biggest Gains Ranking'
                        : detailType === 'idealLap'
                        ? 'Ideal Lap Ranking'
                        : `Sector Ranking (${sectorLabel[selectedSectorFilter]})`}
                </Text>

                {detailType === 'sectorTimes' ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {(['s1', 's2', 's3'] as SectorFilter[]).map(filter => {
                            const active = filter === selectedSectorFilter;
                            return (
                                <TouchableOpacity
                                    key={`detail-sector-filter-${filter}`}
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => setSelectedSectorFilter(filter)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            active && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {sectorLabel[filter]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}

                {detailType === 'gains' ? (
                    improvementInsights.length ? (
                        improvementInsights.map((entry, index) => (
                            <View key={`gains-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • Q1→Q2 {formatGainDelta(entry.q1ToQ2)} • Q2→Q3{' '}
                                        {formatGainDelta(entry.q2ToQ3)}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatGainDelta(entry.improvementToBest)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No qualifying phase deltas available.</Text>
                    )
                ) : null}

                {detailType === 'idealLap' ? (
                    idealLapInsights.length ? (
                        idealLapInsights.map((entry, index) => (
                            <View key={`ideal-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>
                                        {entry.teamName} • Best {formatLapValue(entry.bestLap)} • Potential{' '}
                                        {formatSignedDelta(entry.potentialGain)}
                                    </Text>
                                </View>
                                <Text style={styles.listValue}>{formatLapValue(entry.idealLap)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No ideal lap insights available.</Text>
                    )
                ) : null}

                {detailType === 'sectorTimes' ? (
                    sectorRankings[selectedSectorFilter].length ? (
                        sectorRankings[selectedSectorFilter].map((entry, index) => (
                            <View key={`sector-${selectedSectorFilter}-${entry.driverNumber}`} style={styles.listRow}>
                                <View style={styles.rankPill}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName}>{entry.driverName}</Text>
                                    <Text style={styles.listMeta}>{entry.teamName}</Text>
                                </View>
                                <Text style={styles.listValue}>{formatSectorTime(entry.time)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noData}>No sector timing data available.</Text>
                    )
                ) : null}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default QualifyingInsightsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    heroCard: {
        backgroundColor: semanticColors.surfaceInverse,
        margin: spacing.md,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.base,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        marginTop: spacing.xxs,
        color: semanticColors.surface,
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.bold,
    },
    heroDetail: {
        marginTop: spacing.xxs,
        color: 'rgba(255,255,255,0.8)',
        fontSize: typography.size.base,
    },
    heroDate: {
        marginTop: spacing.xs,
        color: 'rgba(255,255,255,0.7)',
    },
    heroStatsRow: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
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
        marginTop: spacing.xxs,
        color: 'rgba(255,255,255,0.68)',
        fontSize: typography.size.sm,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wide,
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
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    listTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    filterScroll: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    filterContent: {
        paddingVertical: spacing.xxs,
    },
    filterChip: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.borderStrong,
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
        color: semanticColors.textMuted,
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
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: radius.lg,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    rankText: {
        fontWeight: typography.weight.bold,
        color: '#5C6BFF',
    },
    listInfo: {
        flex: 1,
    },
    listName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    listValue: {
        marginLeft: spacing.sm,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    noData: {
        textAlign: 'center',
        color: semanticColors.textMuted,
        fontSize: typography.size.sm,
        paddingVertical: spacing.sm,
    },
    refreshHint: {
        paddingVertical: spacing.xl,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
