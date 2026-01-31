import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../backend/service/openf1Service';
import { theme } from '../../../theme';

interface LapCardProps {
    lap: Lap;
    currentStint?: Stint;
    index?: number; // For staggered animations
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

// Get sector performance indicator (purple/green/yellow based on relative performance)
const getSectorColor = (sectorTime: number | null): string => {
    if (!sectorTime) return theme.colors.text.tertiary;
    // You can enhance this with actual best sector logic
    return theme.colors.text.secondary;
};

export default function LapCard({ lap, currentStint, index = 0 }: LapCardProps) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(20)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: index * 50, // Stagger animation
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                delay: index * 50,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const compoundColor = currentStint
        ? getCompoundColor(currentStint.compound)
        : theme.colors.neutral.gray;

    return (
        <Animated.View
            style={[
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View
                style={[
                    styles.card,
                    lap.is_pit_out_lap && styles.pitOutCard,
                ]}
            >
                {/* Left accent bar */}
                <View
                    style={[
                        styles.accentBar,
                        {
                            backgroundColor: lap.is_pit_out_lap
                                ? theme.colors.semantic.warning
                                : compoundColor,
                        },
                    ]}
                />

                {/* Card content */}
                <View style={styles.content}>
                    {/* Header row */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.lapBadge}>
                                <Text style={styles.lapNumber}>
                                    {lap.lap_number}
                                </Text>
                            </View>
                            <Text style={styles.lapLabel}>LAP</Text>
                        </View>

                        {/* Right badges */}
                        <View style={styles.lapBadges}>
                            {currentStint && (
                                <View
                                    style={[
                                        styles.compoundBadge,
                                        { backgroundColor: compoundColor },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.compoundText,
                                            currentStint.compound.toLowerCase() === 'hard' && {
                                                color: theme.colors.text.primary,
                                            },
                                        ]}
                                    >
                                        {currentStint.compound.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            {lap.is_pit_out_lap && (
                                <View style={styles.pitOutBadge}>
                                    <Ionicons
                                        name="build"
                                        size={14}
                                        color={theme.colors.semantic.warning}
                                    />
                                    <Text style={styles.pitOutText}>PIT OUT</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Lap time */}
                    <View style={styles.lapTimeContainer}>
                        <View style={styles.lapTimeIcon}>
                            <Ionicons
                                name="timer"
                                size={20}
                                color={theme.colors.primary.red}
                            />
                        </View>
                        <View style={styles.lapTimeContent}>
                            <Text style={styles.lapTimeLabel}>Lap Time</Text>
                            <Text style={styles.lapTime}>
                                {formatLapTime(lap.lap_duration)}
                            </Text>
                        </View>
                    </View>

                    {/* Sector times */}
                    <View style={styles.sectorsContainer}>
                        <View style={styles.sectorItem}>
                            <Text style={styles.sectorLabel}>SECTOR 1</Text>
                            <Text
                                style={[
                                    styles.sectorValue,
                                    { color: getSectorColor(lap.duration_sector_1) },
                                ]}
                            >
                                {lap.duration_sector_1?.toFixed(3) || '-'}
                            </Text>
                        </View>

                        <View style={styles.sectorDivider} />

                        <View style={styles.sectorItem}>
                            <Text style={styles.sectorLabel}>SECTOR 2</Text>
                            <Text
                                style={[
                                    styles.sectorValue,
                                    { color: getSectorColor(lap.duration_sector_2) },
                                ]}
                            >
                                {lap.duration_sector_2?.toFixed(3) || '-'}
                            </Text>
                        </View>

                        <View style={styles.sectorDivider} />

                        <View style={styles.sectorItem}>
                            <Text style={styles.sectorLabel}>SECTOR 3</Text>
                            <Text
                                style={[
                                    styles.sectorValue,
                                    { color: getSectorColor(lap.duration_sector_3) },
                                ]}
                            >
                                {lap.duration_sector_3?.toFixed(3) || '-'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.md,
        ...theme.shadows.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    pitOutCard: {
        backgroundColor: theme.colors.semantic.warning + '08', // 8% opacity
        borderColor: theme.colors.semantic.warning + '30', // 30% opacity
    },

    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },

    content: {
        padding: theme.spacing.base,
        paddingLeft: theme.spacing.lg,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },

    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    lapBadge: {
        backgroundColor: theme.colors.primary.carbon,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        marginRight: theme.spacing.sm,
        minWidth: 44,
        alignItems: 'center',
    },

    lapNumber: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
    },

    lapLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        letterSpacing: theme.typography.letterSpacing.wider,
    },

    lapBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },

    compoundBadge: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        ...theme.shadows.sm,
    },

    compoundText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    pitOutBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.semantic.warning + '20', // 20% opacity
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        gap: theme.spacing.xs,
    },

    pitOutText: {
        color: theme.colors.semantic.warning,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    divider: {
        height: 1,
        backgroundColor: theme.colors.border.light,
        marginBottom: theme.spacing.md,
    },

    lapTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    lapTimeIcon: {
        marginRight: theme.spacing.md,
    },

    lapTimeContent: {
        flex: 1,
    },

    lapTimeLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
        marginBottom: 2,
    },

    lapTime: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.primary.red,
        fontVariant: ['tabular-nums'],
    },

    sectorsContainer: {
        flexDirection: 'row',
        backgroundColor: theme.colors.background.tertiary,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    sectorItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing.xs,
    },

    sectorLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        marginBottom: theme.spacing.xs,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    sectorValue: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        fontVariant: ['tabular-nums'],
    },

    sectorDivider: {
        width: 1,
        backgroundColor: theme.colors.border.light,
        marginHorizontal: theme.spacing.xs,
    },
});