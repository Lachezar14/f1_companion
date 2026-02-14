import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint, PitStop } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import TyreCompoundBadge from '../common/TyreCompoundBadge';
import { calculateAvgLapTimePerCompound } from '../../../utils/lap';
import { getCompoundName } from '../../../utils/tyre';
import { colors, radius, semanticColors, spacing, typography } from '../../theme/tokens';

interface RaceStatsSectionProps {
    raceResult: any;
    lapCount: number;
    laps: Lap[];
    stints: Stint[];
    pitStops: PitStop[];
    safetyCarLapSet?: Set<number>;
}
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const COMPOUND_DISPLAY_ORDER: Record<string, number> = {
    soft: 0,
    medium: 1,
    hard: 2,
    inters: 3,
    intermediate: 3,
    wet: 4,
};

export default function RaceStatsSection({
    raceResult,
    lapCount,
    laps,
    stints,
    pitStops,
    safetyCarLapSet,
}: RaceStatsSectionProps) {
    const pitStopCount = pitStops?.length ?? 0;
    const avgPitStopDuration = (() => {
        if (!pitStopCount) return null;
        const durations = pitStops
            .map(stop => stop.stop_duration)
            .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
        if (!durations.length) return null;
        const sum = durations.reduce((total, duration) => total + duration, 0);
        return sum / durations.length;
    })();

    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints, {
        excludedLapNumbers: safetyCarLapSet,
    }).sort((a, b) => {
        const aName = getCompoundName(a.compound).trim().toLowerCase();
        const bName = getCompoundName(b.compound).trim().toLowerCase();
        const aRank = COMPOUND_DISPLAY_ORDER[aName] ?? Number.MAX_SAFE_INTEGER;
        const bRank = COMPOUND_DISPLAY_ORDER[bName] ?? Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        return aName.localeCompare(bName);
    });

    const statCards: {
        key: string;
        label: string;
        value: string | number;
        icon: IoniconName;
        tint: string;
        accent: string;
    }[] = [
        /*{ key: 'result', label: 'Result', value: formattedRaceResult, icon: 'trophy', tint: 'rgba(109,225,156,0.18)', accent: colors.accents.mint },*/
        { key: 'pitStops', label: 'Pit Stops', value: pitStopCount, icon: 'build', tint: 'rgba(255,138,92,0.15)', accent: colors.accents.peach },
        {
            key: 'avgPitStop',
            label: 'Avg Pit Stop',
            value: avgPitStopDuration ? `${avgPitStopDuration.toFixed(2)}s` : '—',
            icon: 'timer-outline',
            tint: 'rgba(131,146,255,0.18)',
            accent: '#8392FF',
        },
        { key: 'laps', label: 'Laps', value: lapCount, icon: 'flag', tint: 'rgba(62,197,255,0.2)', accent: colors.accents.aqua },
    ];

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.overline}>Grand Prix Detail</Text>
                <Text style={styles.title}>Race Stats</Text>
                <Text style={styles.subtitle}>Result, pit strategy and tyre averages</Text>
            </View>

            <View style={styles.statGrid}>
                {statCards.map(stat => (
                    <View key={stat.key} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: stat.tint }]}>
                            <Ionicons name={stat.icon} size={20} color={stat.accent} />
                        </View>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                        <Text style={styles.statValue}>{stat.value}</Text>
                    </View>
                ))}
            </View>

            {avgLapTimesPerCompound.length > 0 && (
                <View style={styles.compoundCard}>
                    <View style={styles.compoundHeader}>
                        <Text style={styles.compoundTitle}>Average Lap Time by Compound</Text>
                        <Text style={styles.compoundSubtitle}>Ignoring pit exit laps & safety car tours</Text>
                    </View>
                    {avgLapTimesPerCompound.map((stat, index) => {
                        const compoundName = getCompoundName(stat.compound);
                        return (
                        <View
                            key={stat.compound}
                            style={[
                                styles.compoundRow,
                                index === avgLapTimesPerCompound.length - 1 && styles.compoundRowLast,
                            ]}
                        >
                            <View style={styles.compoundInfo}>
                                <TyreCompoundBadge
                                    compound={stat.compound}
                                    size={42}
                                    style={styles.compoundBadge}
                                />
                                <View>
                                    <Text style={styles.compoundName}>{compoundName}</Text>
                                    <Text style={styles.compoundLapCount}>
                                        {stat.lapCount} {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.pacePill}>
                                <Ionicons name="time-outline" size={14} color={semanticColors.textPrimary} />
                                <Text style={styles.compoundStatTime}>
                                    {formatLapTime(stat.avgTime)}
                                </Text>
                            </View>
                        </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const CARD_BASE = {
    backgroundColor: semanticColors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: '#E1E4EF',
    shadowColor: '#0F1325',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
};

const styles = StyleSheet.create({
    card: {
        ...CARD_BASE,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        padding: spacing.lg,
    },
    header: {
        marginBottom: spacing.lg,
    },
    overline: {
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
    },
    title: {
        marginTop: spacing.xs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    subtitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
    },
    statGrid: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        backgroundColor: semanticColors.surfaceMuted,
        borderWidth: 1,
        borderColor: '#DFE3EE',
    },
    statIcon: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    statLabel: {
        fontSize: typography.size.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: semanticColors.textMuted,
        fontWeight: typography.weight.bold,
    },
    statValue: {
        marginTop: spacing.xs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    compoundCard: {
        marginTop: spacing.xl,
        backgroundColor: semanticColors.surfaceMuted,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#DFE3EE',
    },
    compoundHeader: {
        marginBottom: spacing.md,
    },
    compoundTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    compoundSubtitle: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: '#81859A',
    },
    compoundRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#DDE1ED',
    },
    compoundRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    compoundInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    compoundBadge: {
        marginRight: 2,
    },
    compoundName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        textTransform: 'capitalize',
    },
    compoundLapCount: {
        fontSize: typography.size.sm,
        color: '#8589A0',
        marginTop: 2,
    },
    pacePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: '#E1E4EF',
    },
    compoundStatTime: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
});
