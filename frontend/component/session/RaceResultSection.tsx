import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PodiumFinisher } from '../../../backend/service/openf1Service';
import { theme } from '../../../theme';

interface RaceResultSectionProps {
    podium: PodiumFinisher[];
    podiumError: string | null;
    onRetry: () => void;
}

export default function RaceResultSection({
                                              podium,
                                              podiumError,
                                              onRetry,
                                          }: RaceResultSectionProps) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    // Get podium colors
    const getPodiumColor = (position: number): string => {
        switch (position) {
            case 1:
                return theme.colors.podium.gold;
            case 2:
                return theme.colors.podium.silver;
            case 3:
                return theme.colors.podium.bronze;
            default:
                return theme.colors.neutral.gray;
        }
    };

    // Get podium emoji
    const getPodiumEmoji = (position: number): string => {
        switch (position) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return '';
        }
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                        <Ionicons
                            name="trophy"
                            size={20}
                            color={theme.colors.podium.gold}
                        />
                    </View>
                    <Text style={styles.title}>Race Podium</Text>
                </View>
            </View>

            {/* Content */}
            {podiumError ? (
                <View style={styles.errorBox}>
                    <View style={styles.errorIconContainer}>
                        <Ionicons
                            name="alert-circle"
                            size={24}
                            color={theme.colors.semantic.danger}
                        />
                    </View>
                    <View style={styles.errorContent}>
                        <Text style={styles.errorText}>{podiumError}</Text>
                        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                            <Ionicons
                                name="refresh"
                                size={16}
                                color={theme.colors.neutral.white}
                            />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : podium.length > 0 ? (
                <View style={styles.podiumContainer}>
                    {podium.map((finisher, index) => (
                        <PodiumCard
                            key={finisher.position}
                            finisher={finisher}
                            index={index}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons
                        name="timer-outline"
                        size={48}
                        color={theme.colors.neutral.gray}
                    />
                    <Text style={styles.emptyText}>Race data not yet available</Text>
                    <Text style={styles.emptySubtext}>
                        Results will appear after the race
                    </Text>
                </View>
            )}

            {/* Bottom accent */}
            <View style={styles.bottomAccent} />
        </Animated.View>
    );
}

interface PodiumCardProps {
    finisher: PodiumFinisher;
    index: number;
}

function PodiumCard({ finisher, index }: PodiumCardProps) {
    const scaleAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            delay: index * 150,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, []);

    const getPodiumColor = (position: number): string => {
        switch (position) {
            case 1:
                return theme.colors.podium.gold;
            case 2:
                return theme.colors.podium.silver;
            case 3:
                return theme.colors.podium.bronze;
            default:
                return theme.colors.neutral.gray;
        }
    };

    const getPodiumEmoji = (position: number): string => {
        switch (position) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return '';
        }
    };

    const podiumColor = getPodiumColor(finisher.position);
    const emoji = getPodiumEmoji(finisher.position);

    return (
        <Animated.View
            style={[
                styles.podiumCard,
                finisher.position === 1 && styles.podiumCardFirst,
                { transform: [{ scale: scaleAnim }] },
            ]}
        >
            {/* Position indicator */}
            <View
                style={[
                    styles.positionIndicator,
                    { backgroundColor: podiumColor + '20' }, // 20% opacity
                ]}
            >
                <Text style={[styles.positionNumber, { color: podiumColor }]}>
                    {finisher.position}
                </Text>
                {emoji && <Text style={styles.positionEmoji}>{emoji}</Text>}
            </View>

            {/* Driver info */}
            <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{finisher.driver}</Text>
                <Text style={styles.constructorName}>{finisher.constructor}</Text>

                {finisher.time && (
                    <View style={styles.timeContainer}>
                        <Ionicons
                            name="timer"
                            size={14}
                            color={theme.colors.text.tertiary}
                        />
                        <Text style={styles.timeText}>
                            {finisher.position === 1 ? '' : '+'}
                            {finisher.time}
                        </Text>
                    </View>
                )}
            </View>

            {/* Chevron */}
            <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.text.tertiary}
            />

            {/* Left accent bar */}
            <View style={[styles.accentBar, { backgroundColor: podiumColor }]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.xl,
        overflow: 'hidden',
        ...theme.shadows.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        margin: theme.spacing.base,
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
        backgroundColor: theme.colors.podium.gold + '15', // 15% opacity
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

    podiumContainer: {
        padding: theme.spacing.base,
        gap: theme.spacing.sm,
    },

    podiumCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        padding: theme.spacing.base,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        position: 'relative',
        overflow: 'hidden',
    },

    podiumCardFirst: {
        backgroundColor: theme.colors.podium.gold + '08', // 8% opacity
        borderColor: theme.colors.podium.gold + '40', // 40% opacity
        borderWidth: 2,
    },

    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },

    positionIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.neutral.lightGray,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        marginRight: theme.spacing.base,
        marginLeft: theme.spacing.xs,
        minWidth: 60,
        gap: theme.spacing.xs,
    },

    positionNumber: {
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: theme.typography.fontWeight.black,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    positionEmoji: {
        fontSize: theme.typography.fontSize.xl,
    },

    driverInfo: {
        flex: 1,
    },

    driverName: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: 2,
    },

    constructorName: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
        marginBottom: theme.spacing.xs,
        fontWeight: theme.typography.fontWeight.medium,
    },

    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },

    timeText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.primary.red,
        fontVariant: ['tabular-nums'],
    },

    errorBox: {
        flexDirection: 'row',
        backgroundColor: theme.colors.semantic.danger + '10', // 10% opacity
        padding: theme.spacing.base,
        margin: theme.spacing.base,
        borderRadius: theme.borderRadius.lg,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.semantic.danger,
    },

    errorIconContainer: {
        marginRight: theme.spacing.md,
    },

    errorContent: {
        flex: 1,
    },

    errorText: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.semantic.danger,
        marginBottom: theme.spacing.md,
        fontWeight: theme.typography.fontWeight.medium,
    },

    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.semantic.danger,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        borderRadius: theme.borderRadius.md,
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
    },

    retryButtonText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.semibold,
    },

    emptyState: {
        alignItems: 'center',
        paddingVertical: theme.spacing['3xl'],
        paddingHorizontal: theme.spacing.base,
    },

    emptyText: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.xs,
    },

    emptySubtext: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
    },

    bottomAccent: {
        height: 4,
        backgroundColor: theme.colors.podium.gold,
        borderBottomLeftRadius: theme.borderRadius.xl,
        borderBottomRightRadius: theme.borderRadius.xl,
    },
});