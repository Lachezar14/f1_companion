import React, { useCallback, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getQualifyingSessionDetail } from '../../../../backend/service/openf1Service';
import type { QualifyingSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { formatLapTime } from '../../../../shared/time';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

type QualifyingInsightDetailType = 'gains' | 'idealLap' | 'sectorTimes';
type SectorFilter = 's1' | 's2' | 's3';

type SectorRankingRow = {
    driverNumber: number;
    driverName: string;
    teamName: string;
    time: number;
};
type DriverOption = {
    driverNumber: number;
    name: string;
    team: string;
    teamColor?: string | null;
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

const parseLapTimeToSeconds = (value: string | null | undefined): number | null => {
    if (!value || value === '—') return null;
    const normalized = value.trim();

    const dotFormat = normalized.match(/^(\d+):(\d{1,2})\.(\d{3})$/);
    if (dotFormat) {
        const minutes = Number(dotFormat[1]);
        const seconds = Number(dotFormat[2]);
        const millis = Number(dotFormat[3]);
        if ([minutes, seconds, millis].some(part => Number.isNaN(part))) return null;
        return minutes * 60 + seconds + millis / 1000;
    }

    const colonFormat = normalized.match(/^(\d+):(\d{1,2}):(\d{3})$/);
    if (colonFormat) {
        const minutes = Number(colonFormat[1]);
        const seconds = Number(colonFormat[2]);
        const millis = Number(colonFormat[3]);
        if ([minutes, seconds, millis].some(part => Number.isNaN(part))) return null;
        return minutes * 60 + seconds + millis / 1000;
    }

    return null;
};

const QualifyingScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<SectorFilter>('s1');

    const loadSession = useCallback(
        () => getQualifyingSessionDetail(sessionKey),
        [sessionKey]
    );

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<QualifyingSessionDetail>(loadSession, [loadSession]);

    const rows = data?.classification ?? [];
    const driverEntries = data?.drivers ?? [];
    const improvementInsights = data?.insights.improvementIndex.drivers ?? [];
    const sectorKings = data?.insights.sectorKings;
    const idealLapInsights = sectorKings?.idealLaps ?? [];
    const topImprovementInsights = improvementInsights.slice(0, 3);
    const topIdealLapInsights = idealLapInsights.slice(0, 3);

    const driverEntryMap = useMemo(
        () => new Map(driverEntries.map(entry => [entry.driverNumber, entry])),
        [driverEntries]
    );
    const driverOptions = useMemo<DriverOption[]>(
        () =>
            rows.map(row => {
                const entry = driverEntryMap.get(row.driverNumber);
                return {
                    driverNumber: row.driverNumber,
                    name: row.driverName,
                    team: row.teamName,
                    teamColor: entry?.driver.teamColor ?? row.teamColor ?? null,
                };
            }),
        [driverEntryMap, rows]
    );
    const defaultDriverNumber = useMemo(() => {
        if (rows.length && rows[0]?.driverNumber) {
            return rows[0].driverNumber;
        }
        return driverEntries[0]?.driverNumber ?? null;
    }, [rows, driverEntries]);

    const heroDate = data?.date_start
        ? new Date(data.date_start).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        })
        : null;

    const poleLap = rows[0]?.best ?? '—';
    const getBestRowLapSeconds = (row: { q1: string | null; q2: string | null; q3: string | null; best: string | null }) => {
        const phaseTimes = [row.q1, row.q2, row.q3]
            .map(parseLapTimeToSeconds)
            .filter((time): time is number => typeof time === 'number' && Number.isFinite(time));
        if (phaseTimes.length) return Math.min(...phaseTimes);
        return parseLapTimeToSeconds(row.best);
    };
    const lastDriverWithLap = useMemo(
        () =>
            [...rows]
                .reverse()
                .find(row => getBestRowLapSeconds(row) != null) ?? null,
        [rows]
    );
    const poleMargin = useMemo(() => {
        if (!rows.length || !lastDriverWithLap) return '—';

        const poleSeconds = getBestRowLapSeconds(rows[0]);
        const lastSeconds = getBestRowLapSeconds(lastDriverWithLap);
        if (poleSeconds == null || lastSeconds == null) {
            return lastDriverWithLap.gapToPole ?? '—';
        }

        const delta = lastSeconds - poleSeconds;
        if (!Number.isFinite(delta)) return '—';
        return `+${Math.max(delta, 0).toFixed(3)}s`;
    }, [lastDriverWithLap, rows]);
    const q3Cutoff = rows.find(row => row.position === 10)?.q2 ?? null;
    const q2Cutoff = rows.find(row => row.position === 15)?.q1 ?? null;

    const heroStats = [
        { label: 'Drivers', value: rows.length || '–' },
        { label: 'Pole Lap', value: poleLap },
        { label: 'Grid Margin', value: poleMargin },
    ];

    const insightsMetrics = [
        { label: 'Q3 Cutoff', value: q3Cutoff ?? '—' },
        { label: 'Q2 Cutoff', value: q2Cutoff ?? '—' }
    ];

    const poleResult = rows[0] ?? null;
    const poleGap = rows[1]?.gapToPole ?? '—';

    const sectorRankings = useMemo(() => buildSectorRankings(driverEntries), [driverEntries]);
    const topSectorRows = sectorRankings[selectedSectorFilter].slice(0, 3);

    const formatSectorTime = (value?: number) =>
        typeof value === 'number' && value > 0 ? `${value.toFixed(3)}s` : '—';
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
    const sectorLabel: Record<SectorFilter, string> = {
        s1: 'Sector 1',
        s2: 'Sector 2',
        s3: 'Sector 3',
    };

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('QualifyingClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const handleOpenDriverQualifyingDetails = useCallback(
        (driverNumber: number | null) => {
            if (typeof driverNumber !== 'number') return;
            navigation.navigate('DriverQualifyingOverview', {
                driverNumber,
                sessionKey,
                sessionName,
                meetingName,
                driverData: driverEntryMap.get(driverNumber) ?? null,
                driverOptions,
            });
        },
        [driverEntryMap, driverOptions, meetingName, navigation, sessionKey, sessionName]
    );
    const handleOpenDriverOverview = useCallback(() => {
        handleOpenDriverQualifyingDetails(defaultDriverNumber);
    }, [defaultDriverNumber, handleOpenDriverQualifyingDetails]);

    const handleOpenInsightDetails = useCallback(
        (detailType: QualifyingInsightDetailType, initialFilter?: string) => {
            navigation.navigate('QualifyingInsights', {
                sessionKey,
                sessionName,
                meetingName,
                detailType,
                initialFilter,
            });
        },
        [meetingName, navigation, sessionKey, sessionName]
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading qualifying data...</Text>
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
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor={semanticColors.danger}
                />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <Text style={styles.heroSubtitle}>{meetingName || data?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {heroDate ? <Text style={styles.heroDate}>{heroDate}</Text> : null}
                    <View style={styles.chipRow}>
                        {data?.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{data.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        <View style={styles.chip}>
                            <Text style={styles.chipText}>{rows.length} Drivers</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.heroStats}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    activeOpacity={0.9}
                    onPress={handleOpenClassification}
                >
                    <Text style={styles.actionButtonText}>View Classification</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {rows.length || 0} {rows.length === 1 ? 'driver' : 'drivers'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        styles.actionButtonSecondary,
                        !defaultDriverNumber && styles.actionButtonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleOpenDriverOverview}
                    disabled={!defaultDriverNumber}
                >
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>
                        Driver Overview
                    </Text>
                    <Text style={[styles.actionButtonSubtitle, styles.actionButtonSubtitleDark]}>
                        Open full qualifying driver detail
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.snapshotCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Qualifying Snapshot</Text>
                    <Text style={styles.cardTitle}>Phase cut-offs & pole data</Text>
                </View>
                <View style={styles.metricRow}>
                    {insightsMetrics.map(metric => (
                        <View key={metric.label} style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metric.value}</Text>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {poleResult ? (
                <View style={styles.poleCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardOverline}>Pole Position</Text>
                    </View>
                    <Text style={styles.poleDriver}>{poleResult.driverName}</Text>
                    <Text style={styles.poleTeam}>{poleResult.teamName}</Text>
                    <View style={styles.poleMetaRow}>
                        <View style={styles.poleMetaItem}>
                            <Text style={styles.poleMetaLabel}>Pole Lap</Text>
                            <Text style={styles.poleMetaValue}>{poleResult.best ?? poleLap}</Text>
                        </View>
                        <View style={styles.poleMetaItem}>
                            <Text style={styles.poleMetaLabel}>Gap to P2</Text>
                            <Text style={styles.poleMetaValue}>{poleGap}</Text>
                        </View>
                    </View>
                </View>
            ) : null}

            <View style={styles.sectorCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Micro Sectors</Text>
                    <Text style={styles.cardTitle}>Fastest drivers per sector</Text>
                    <Text style={styles.cardSubtitle}>
                        Top 3 drivers on {sectorLabel[selectedSectorFilter]}
                    </Text>
                </View>
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
                                key={`sector-filter-${filter}`}
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
                {topSectorRows.length ? (
                    topSectorRows.map((entry, index) => (
                        <View
                            key={`sector-${selectedSectorFilter}-${entry.driverNumber}`}
                            style={styles.analyticsRow}
                        >
                            <View style={styles.analyticsRank}>
                                <Text style={styles.analyticsRankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.analyticsInfo}>
                                <Text style={styles.analyticsName}>{entry.driverName}</Text>
                                <Text style={styles.analyticsMeta}>{entry.teamName}</Text>
                            </View>
                            <Text style={styles.analyticsValue}>
                                {formatSectorTime(entry.time)}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noDataText}>No sector timing data available.</Text>
                )}
                <TouchableOpacity
                    style={styles.storyButton}
                    onPress={() =>
                        handleOpenInsightDetails('sectorTimes', selectedSectorFilter)
                    }
                >
                    <Text style={styles.storyButtonText}>View Full Sector Times</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.analyticsCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Quali Improvement Index</Text>
                    <Text style={styles.cardTitle}>Who found the biggest gains?</Text>
                    <Text style={styles.cardSubtitle}>Top 3 from Q1 baseline to best lap</Text>
                </View>
                {topImprovementInsights.length ? (
                    topImprovementInsights.map((entry, index) => (
                        <View key={`improvement-${entry.driverNumber}`} style={styles.analyticsRow}>
                            <View style={styles.analyticsRank}>
                                <Text style={styles.analyticsRankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.analyticsInfo}>
                                <Text style={styles.analyticsName}>{entry.driverName}</Text>
                                <Text style={styles.analyticsMeta}>
                                    {entry.teamName} • Q1→Q2 {formatGainDelta(entry.q1ToQ2)} • Q2→Q3{' '}
                                    {formatGainDelta(entry.q2ToQ3)}
                                </Text>
                            </View>
                            <Text style={styles.analyticsValue}>
                                {formatGainDelta(entry.improvementToBest)}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noDataText}>No qualifying phase deltas available.</Text>
                )}
                {improvementInsights.length ? (
                    <TouchableOpacity
                        style={styles.storyButton}
                        onPress={() => handleOpenInsightDetails('gains')}
                    >
                        <Text style={styles.storyButtonText}>View Full Gains Ranking</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.analyticsCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Sector Kings</Text>
                    <Text style={styles.cardTitle}>Ideal lap potential</Text>
                    <Text style={styles.cardSubtitle}>
                        Top 3 drivers by ideal lap (best sectors across qualifying)
                    </Text>
                </View>
                {topIdealLapInsights.length ? (
                    topIdealLapInsights.map((entry, index) => (
                        <View key={`ideal-${entry.driverNumber}`} style={styles.analyticsRow}>
                            <View style={styles.analyticsRank}>
                                <Text style={styles.analyticsRankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.analyticsInfo}>
                                <Text style={styles.analyticsName}>{entry.driverName}</Text>
                                <Text style={styles.analyticsMeta}>
                                    {entry.teamName} • Best {formatLapValue(entry.bestLap)} • Potential{' '}
                                    {formatSignedDelta(entry.potentialGain)}
                                </Text>
                            </View>
                            <Text style={styles.analyticsValue}>{formatLapValue(entry.idealLap)}</Text>
                        </View>
                    ))
                ) : null}
                {idealLapInsights.length ? (
                    <TouchableOpacity
                        style={styles.storyButton}
                        onPress={() => handleOpenInsightDetails('idealLap')}
                    >
                        <Text style={styles.storyButtonText}>View Full Ideal Lap Ranking</Text>
                    </TouchableOpacity>
                ) : null}
                {!topIdealLapInsights.length ? (
                    <Text style={styles.noDataText}>No ideal lap insights available.</Text>
                ) : null}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default QualifyingScreen;

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
    heroContent: {
        marginBottom: spacing.md,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.base,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginTop: spacing.xs,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.72)',
        marginTop: spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    chip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: overlays.white15,
    },
    chipText: {
        color: semanticColors.surface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        letterSpacing: 0.4,
    },
    heroStats: {
        flexDirection: 'row',
        backgroundColor: overlays.white08,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
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
        fontSize: typography.size.sm,
        letterSpacing: 0.7,
        marginTop: spacing.xxs,
        textTransform: 'uppercase',
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xxs,
    },
    actionButton: {
        borderRadius: radius.xl,
        flex: 1,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: semanticColors.textPrimary,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    actionButtonSecondary: {
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.borderStrong,
        shadowOpacity: 0.05,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    actionButtonSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    actionButtonTextDark: {
        color: semanticColors.textPrimary,
    },
    actionButtonSubtitleDark: {
        color: '#6E738B',
    },
    snapshotCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    cardHeader: {
        marginBottom: spacing.md,
    },
    cardOverline: {
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        textTransform: 'uppercase',
    },
    cardTitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    cardSubtitle: {
        marginTop: 2,
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
    metricRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    metricItem: {
        flex: 1,
        backgroundColor: semanticColors.surfaceMuted,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
    },
    metricValue: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    metricLabel: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    poleCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: '#F8F5FF',
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    poleDriver: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.heavy,
        color: '#2A1F5D',
    },
    poleTeam: {
        fontSize: typography.size.base,
        color: '#6C5FA5',
        marginTop: 2,
    },
    poleMetaRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    poleMetaItem: {
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
    },
    poleMetaLabel: {
        fontSize: typography.size.xs,
        color: '#8A83B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: typography.weight.bold,
    },
    poleMetaValue: {
        marginTop: spacing.xs,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: '#2A1F5D',
    },
    sectorCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    sectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.borderMuted,
    },
    sectorLabelBlock: {
        flex: 1,
    },
    sectorLabel: {
        fontSize: typography.size.sm,
        color: '#9297B0',
        textTransform: 'uppercase',
        fontWeight: typography.weight.bold,
        letterSpacing: 0.8,
    },
    sectorDriver: {
        marginTop: spacing.xxs,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: '#1F2435',
    },
    sectorTeam: {
        fontSize: typography.size.sm,
        color: '#7A819D',
    },
    sectorTime: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginLeft: spacing.sm,
    },
    analyticsCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    analyticsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: semanticColors.borderMuted,
    },
    analyticsRank: {
        width: 28,
        height: 28,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        marginRight: spacing.sm,
    },
    analyticsRankText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#4B58D8',
    },
    analyticsInfo: {
        flex: 1,
    },
    analyticsName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1F2435',
    },
    analyticsMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: '#7A819D',
    },
    analyticsValue: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1F2435',
        marginLeft: spacing.sm,
    },
    storyButton: {
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        alignItems: 'center',
        backgroundColor: semanticColors.textPrimary,
    },
    storyButtonText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.wide,
    },
    analyticsSubSection: {
        marginTop: spacing.sm,
    },
    analyticsSubTitle: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: typography.weight.bold,
        marginBottom: spacing.xxs,
    },
    noDataText: {
        fontSize: typography.size.sm,
        color: '#8A8FA6',
        paddingVertical: spacing.xs,
        textAlign: 'center',
    },
    refreshHint: {
        paddingVertical: spacing.xl,
        textAlign: 'center',
        color: semanticColors.textMuted,
    },
});
