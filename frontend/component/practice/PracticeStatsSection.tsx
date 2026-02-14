import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import TyreCompoundBadge from '../common/TyreCompoundBadge';
import { calculateTypicalLapDuration, calculateAvgLapTimePerCompound } from '../../../utils/lap';
import { getCompoundName } from '../../../utils/tyre';
import { colors, radius, semanticColors, spacing, typography } from '../../theme/tokens';

interface PracticeStatsSectionProps {
    lapCount: number;
    stints: Stint[];
    laps: Lap[];
}
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ALLOWED_LAP_DELTA_SECONDS = 5;
const COMPOUND_DISPLAY_ORDER: Record<string, number> = {
    soft: 0,
    medium: 1,
    hard: 2,
    inters: 3,
    intermediate: 3,
    wet: 4,
};

export default function PracticeStatsSection({ lapCount, stints, laps }: PracticeStatsSectionProps) {
    const typicalLapDuration = calculateTypicalLapDuration(laps);
    const lapThreshold = typicalLapDuration !== null ? typicalLapDuration + ALLOWED_LAP_DELTA_SECONDS : null;

    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints, {
        lapThreshold,
    }).sort((a, b) => {
        const aName = getCompoundName(a.compound).trim().toLowerCase();
        const bName = getCompoundName(b.compound).trim().toLowerCase();
        const aRank = COMPOUND_DISPLAY_ORDER[aName] ?? Number.MAX_SAFE_INTEGER;
        const bRank = COMPOUND_DISPLAY_ORDER[bName] ?? Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        return aName.localeCompare(bName);
    });

    const normalizedCompoundNames = stints
        .map(stint => stint.compound?.trim().toLowerCase())
        .filter((compound): compound is string => Boolean(compound));

    const compoundsUsed =
        normalizedCompoundNames.length > 0 ? new Set(normalizedCompoundNames).size : '—';

    const statCards: { key: string; label: string; value: string | number; icon: IoniconName; tint: string; accent: string }[] = [
        {
            key: 'laps',
            label: 'Laps',
            value: lapCount,
            icon: 'flag-outline',
            tint: 'rgba(62,197,255,0.22)',
            accent: colors.accents.aqua,
        },
        {
            key: 'stints',
            label: 'Stints',
            value: stints.length,
            icon: 'git-branch-outline',
            tint: 'rgba(255,138,92,0.2)',
            accent: colors.accents.peach,
        },
        /*{
            key: 'compounds',
            label: 'Compounds',
            value: compoundsUsed,
            icon: 'color-palette-outline',
            tint: 'rgba(172,140,255,0.2)',
            accent: colors.accents.lavender,
        },*/
    ];

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.overline}>Practice Pace</Text>
                <Text style={styles.title}>Free Practice Summary</Text>
                <Text style={styles.subtitle}>Session totals, stint count and headline lap pace</Text>
            </View>

            <View style={styles.statGrid}>
                {statCards.map(stat => (
                    <View key={stat.key} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: stat.tint }]}
                        >
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
                        <Text style={styles.compoundTitle}>Tyre Compounds</Text>
                        <Text style={styles.compoundSubtitle}>Average lap (excludes slow-down laps)</Text>
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
                                    size={46}
                                    style={styles.compoundBadge}
                                />
                                <View>
                                    <Text style={styles.compoundName}>{compoundName}</Text>
                                    <Text style={styles.compoundLapCount}>
                                        {stat.lapCount} {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.compoundPacePill}>
                                <Ionicons name="time-outline" size={14} color={semanticColors.textPrimary} />
                                <Text style={styles.compoundTime}>{formatLapTime(stat.avgTime)}</Text>
                            </View>
                        </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.09,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
        elevation: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#EBEFF5',
    },
    header: {
        marginBottom: spacing.lg,
    },
    overline: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.wider,
        fontWeight: typography.weight.bold,
        textTransform: 'uppercase',
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
        backgroundColor: '#F7F8FA',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E8F0',
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
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
        fontWeight: typography.weight.bold,
    },
    statValue: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginTop: spacing.xs,
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
        marginTop: 2,
        fontSize: typography.size.sm,
        color: '#8589A0',
    },
    compoundPacePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E1E4EF',
    },
    compoundTime: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
});
