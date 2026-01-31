import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatLapTime } from '../../../backend/service/openf1Service';
import { Lap, Stint } from '../../../backend/types';
import { theme } from '../../../theme'

interface RaceStatsSectionProps {
    raceResult: any;
    lapCount: number;
    stintCount: number;
    laps: Lap[];
    stints: Stint[];
}

// Helper function to get compound colors
const getCompoundColor = (compound: string): string => {
    const compoundLower = compound.toLowerCase();
    switch (compoundLower) {
        case 'soft':
            return theme.colors.tyres.soft;
        case 'medium':
            return theme.colors.tyres.medium;
        case 'hard':
            return theme.colors.tyres.hard;
        case 'intermediate':
            return theme.colors.tyres.intermediate;
        case 'wet':
            return theme.colors.tyres.wet;
        default:
            return theme.colors.neutral.gray;
    }
};

// Helper function to format race result
const formatRaceResult = (raceResult: any): string => {
    if (!raceResult) return '-';

    // Check for DNF, DSQ, DNS statuses (boolean flags)
    if (raceResult.dnf) return 'DNF';
    if (raceResult.dsq) return 'DSQ';
    if (raceResult.dns) return 'DNS';

    // Return position if available
    if (raceResult.position) {
        return `P${raceResult.position}`;
    }

    return '-';
};

// Helper function to calculate average lap time per compound
const calculateAvgLapTimePerCompound = (
    laps: Lap[],
    stints: Stint[]
): { compound: string; avgTime: number; lapCount: number }[] => {
    const compoundMap = new Map<string, { totalTime: number; count: number }>();

    laps.forEach(lap => {
        // Skip pit out laps and laps without duration
        if (lap.is_pit_out_lap || !lap.lap_duration) return;

        // Find the stint for this lap
        const stint = stints.find(
            s => lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end
        );

        if (stint) {
            const compound = stint.compound;
            const existing = compoundMap.get(compound) || { totalTime: 0, count: 0 };
            compoundMap.set(compound, {
                totalTime: existing.totalTime + lap.lap_duration,
                count: existing.count + 1,
            });
        }
    });

    return Array.from(compoundMap.entries()).map(([compound, data]) => ({
        compound,
        avgTime: data.totalTime / data.count,
        lapCount: data.count,
    }));
};

export default function RaceStatsSection({
                                             raceResult,
                                             lapCount,
                                             stintCount,
                                             laps,
                                             stints,
                                         }: RaceStatsSectionProps) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(30)).current;

    React.useEffect(() => {
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
    }, []);

    // Calculate stats internally
    const pitStops = Math.max(0, stintCount - 1);
    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints);
    const formattedRaceResult = formatRaceResult(raceResult);

    // Determine result color
    const getResultColor = () => {
        if (!raceResult) return theme.colors.neutral.gray;
        if (raceResult === 1) return theme.colors.podium.gold;
        if (raceResult === 2) return theme.colors.podium.silver;
        if (raceResult === 3) return theme.colors.podium.bronze;
        if (raceResult <= 10) return theme.colors.semantic.info;
        return theme.colors.text.secondary;
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                        <Ionicons
                            name="stats-chart"
                            size={20}
                            color={theme.colors.primary.red}
                        />
                    </View>
                    <Text style={styles.title}>Race Statistics</Text>
                </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                {/* Result */}
                <View style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <Ionicons
                            name="trophy"
                            size={28}
                            color={getResultColor()}
                        />
                    </View>
                    <Text style={[styles.statValue, { color: getResultColor() }]}>
                        {formattedRaceResult}
                    </Text>
                    <Text style={styles.statLabel}>Final Position</Text>
                </View>

                {/* Laps */}
                <View style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <Ionicons
                            name="flag"
                            size={28}
                            color={theme.colors.semantic.info}
                        />
                    </View>
                    <Text style={styles.statValue}>{lapCount}</Text>
                    <Text style={styles.statLabel}>Laps Completed</Text>
                </View>

                {/* Pit Stops */}
                <View style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <Ionicons
                            name="build"
                            size={28}
                            color={theme.colors.semantic.warning}
                        />
                    </View>
                    <Text style={styles.statValue}>{pitStops}</Text>
                    <Text style={styles.statLabel}>Pit Stops</Text>
                </View>
            </View>

            {/* Compound Performance Section */}
            {avgLapTimesPerCompound.length > 0 && (
                <View style={styles.compoundSection}>
                    {/* Section Header */}
                    <View style={styles.compoundHeader}>
                        <Ionicons
                            name="speedometer"
                            size={18}
                            color={theme.colors.text.secondary}
                        />
                        <Text style={styles.compoundTitle}>Tyre Performance</Text>
                    </View>

                    {/* Compound Stats */}
                    {avgLapTimesPerCompound.map((stat, idx) => {
                        const compoundColor = getCompoundColor(stat.compound);

                        return (
                            <View key={idx} style={styles.compoundRow}>
                                {/* Left: Compound info */}
                                <View style={styles.compoundLeft}>
                                    <View
                                        style={[
                                            styles.compoundIndicator,
                                            { backgroundColor: compoundColor },
                                        ]}
                                    />
                                    <View style={styles.compoundInfo}>
                                        <Text style={styles.compoundName}>
                                            {stat.compound.charAt(0).toUpperCase() +
                                                stat.compound.slice(1)}
                                        </Text>
                                        <Text style={styles.compoundLaps}>
                                            {stat.lapCount} lap{stat.lapCount !== 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                </View>

                                {/* Right: Lap time */}
                                <View style={styles.compoundRight}>
                                    <Text style={styles.compoundTime}>
                                        {formatLapTime(stat.avgTime)}
                                    </Text>
                                    <Text style={styles.compoundTimeLabel}>avg</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Bottom decorative element */}
            <View style={styles.bottomAccent} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        margin: theme.spacing.base,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.xl,
        overflow: 'hidden',
        ...theme.shadows.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.base,
        paddingBottom: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
    },

    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.primary.red + '15', // 15% opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.sm,
    },

    title: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    statsGrid: {
        flexDirection: 'row',
        padding: theme.spacing.base,
        gap: theme.spacing.md,
    },

    statCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.base,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    statIconContainer: {
        marginBottom: theme.spacing.sm,
    },

    statValue: {
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    statLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    compoundSection: {
        padding: theme.spacing.base,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.light,
    },

    compoundHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },

    compoundTitle: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        marginLeft: theme.spacing.sm,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    compoundRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    compoundLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    compoundIndicator: {
        width: 14,
        height: 14,
        borderRadius: theme.borderRadius.full,
        marginRight: theme.spacing.md,
        ...theme.shadows.sm,
    },

    compoundInfo: {
        flex: 1,
    },

    compoundName: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
        marginBottom: 2,
    },

    compoundLaps: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.tertiary,
        fontWeight: theme.typography.fontWeight.medium,
    },

    compoundRight: {
        alignItems: 'flex-end',
    },

    compoundTime: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.primary.red,
        fontVariant: ['tabular-nums'],
    },

    compoundTimeLabel: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.tertiary,
        fontWeight: theme.typography.fontWeight.medium,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    bottomAccent: {
        height: 4,
        backgroundColor: theme.colors.primary.red,
        borderBottomLeftRadius: theme.borderRadius.xl,
        borderBottomRightRadius: theme.borderRadius.xl,
    },
});