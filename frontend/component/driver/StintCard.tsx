import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stint } from '../../../backend/types';
import { theme } from '../../../theme';

interface StintCardProps {
    stint: Stint;
}

// Helper function to get compound colors with gradient support
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

// Get tyre icon based on compound
const getTyreIcon = (compound: string): keyof typeof Ionicons.glyphMap => {
    const compoundLower = compound.toLowerCase();
    if (compoundLower === 'intermediate' || compoundLower === 'wet') {
        return 'rainy';
    }
    return 'ellipse';
};

// Helper function to format tyre status
const getTyreStatus = (tyreAge: number): { label: string; color: string } => {
    if (tyreAge === 1) {
        return { label: 'NEW', color: theme.colors.semantic.success };
    } else if (tyreAge <= 5) {
        return { label: 'FRESH', color: theme.colors.semantic.info };
    } else if (tyreAge <= 10) {
        return { label: 'USED', color: theme.colors.semantic.warning };
    } else {
        return { label: 'WORN', color: theme.colors.semantic.danger };
    }
};

export default function StintCard({ stint, index = 0 }: StintCardProps) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(20)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: index * 100, // Stagger animation
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                delay: index * 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const compoundColor = getCompoundColor(stint.compound);
    const tyreIcon = getTyreIcon(stint.compound);
    const tyreStatus = getTyreStatus(stint.tyre_age_at_start);
    const lapCount = stint.lap_end - stint.lap_start + 1;

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
            <View style={styles.card}>
                {/* Left accent bar with compound color */}
                <View style={[styles.accentBar, { backgroundColor: compoundColor }]} />

                {/* Card content */}
                <View style={styles.content}>
                    {/* Header row */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.stintBadge}>
                                <Text style={styles.stintNumber}>#{stint.stint_number}</Text>
                            </View>
                            <Text style={styles.stintLabel}>STINT</Text>
                        </View>

                        {/* Compound badge */}
                        <View
                            style={[
                                styles.compoundBadge,
                                { backgroundColor: compoundColor },
                            ]}
                        >
                            <Ionicons
                                name={tyreIcon}
                                size={16}
                                color={
                                    stint.compound.toLowerCase() === 'hard'
                                        ? theme.colors.text.primary
                                        : theme.colors.neutral.white
                                }
                                style={styles.tyreIcon}
                            />
                            <Text
                                style={[
                                    styles.compoundText,
                                    stint.compound.toLowerCase() === 'hard' && {
                                        color: theme.colors.text.primary,
                                    },
                                ]}
                            >
                                {stint.compound.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Stats grid */}
                    <View style={styles.statsGrid}>
                        {/* Tyre condition */}
                        <View style={styles.statBox}>
                            <View style={styles.statIcon}>
                                <Ionicons
                                    name="speedometer-outline"
                                    size={18}
                                    color={tyreStatus.color}
                                />
                            </View>
                            <View style={styles.statContent}>
                                <Text style={styles.statLabel}>Condition</Text>
                                <Text style={[styles.statValue, { color: tyreStatus.color }]}>
                                    {tyreStatus.label}
                                </Text>
                                <Text style={styles.statSubtext}>
                                    {stint.tyre_age_at_start} lap{stint.tyre_age_at_start !== 1 ? 's' : ''} old
                                </Text>
                            </View>
                        </View>

                        {/* Lap range */}
                        <View style={styles.statBox}>
                            <View style={styles.statIcon}>
                                <Ionicons
                                    name="flag-outline"
                                    size={18}
                                    color={theme.colors.primary.red}
                                />
                            </View>
                            <View style={styles.statContent}>
                                <Text style={styles.statLabel}>Lap Range</Text>
                                <Text style={styles.statValue}>
                                    {stint.lap_start} - {stint.lap_end}
                                </Text>
                                <Text style={styles.statSubtext}>
                                    {lapCount} lap{lapCount !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Progress bar showing stint length */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: compoundColor + '40' }, // 40% opacity
                                ]}
                            />
                        </View>
                        <Text style={styles.progressLabel}>{lapCount} laps on this compound</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },

    card: {
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        ...theme.shadows.md,
        overflow: 'hidden',
        position: 'relative',
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

    stintBadge: {
        backgroundColor: theme.colors.primary.carbon,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        marginRight: theme.spacing.sm,
    },

    stintNumber: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    stintLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.tertiary,
        letterSpacing: theme.typography.letterSpacing.wider,
    },

    compoundBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm,
    },

    tyreIcon: {
        marginRight: theme.spacing.xs,
    },

    compoundText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    divider: {
        height: 1,
        backgroundColor: theme.colors.border.light,
        marginBottom: theme.spacing.md,
    },

    statsGrid: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.md,
    },

    statBox: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    statIcon: {
        marginRight: theme.spacing.sm,
        justifyContent: 'center',
    },

    statContent: {
        flex: 1,
    },

    statLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.medium,
        color: theme.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
        marginBottom: theme.spacing.xs,
    },

    statValue: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: 2,
    },

    statSubtext: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.tertiary,
    },

    progressContainer: {
        marginTop: theme.spacing.xs,
    },

    progressBar: {
        height: 4,
        backgroundColor: theme.colors.neutral.lightGray,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
        marginBottom: theme.spacing.xs,
    },

    progressFill: {
        height: '100%',
        width: '100%', // In real app, this would be dynamic based on stint length
        borderRadius: theme.borderRadius.full,
    },

    progressLabel: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.tertiary,
        textAlign: 'center',
    },
});