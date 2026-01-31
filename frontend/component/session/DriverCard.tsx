import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';

interface DriverSessionData {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    lapCount: number;
    fastestLap: string | null;
    dnf: boolean;
    dns: boolean;
    dsq: boolean;
    teamColor?: string;
}

interface DriverCardProps {
    driver: DriverSessionData;
    sessionKey: number;
    isFirst?: boolean;
    index?: number; // For staggered animations
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function DriverCard({
                                       driver,
                                       sessionKey,
                                       isFirst = false,
                                       index = 0,
                                   }: DriverCardProps) {
    const navigation = useNavigation<NavigationProp>();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePress = () => {
        navigation.navigate('DriverOverview', {
            driverNumber: driver.driverNumber,
            sessionKey: sessionKey,
        });
    };

    const formatPosition = (driver: DriverSessionData): string => {
        if (driver.dns) return 'DNS';
        if (driver.dnf) return 'DNF';
        if (driver.dsq) return 'DSQ';
        if (driver.position) return `P${driver.position}`;
        return '-';
    };

    const getPositionColor = (driver: DriverSessionData): string => {
        if (driver.dns || driver.dnf || driver.dsq) {
            return theme.colors.neutral.gray;
        }
        if (driver.position === 1) return theme.colors.podium.gold;
        if (driver.position === 2) return theme.colors.podium.silver;
        if (driver.position === 3) return theme.colors.podium.bronze;
        if (driver.position && driver.position <= 10) {
            return theme.colors.semantic.info;
        }
        return theme.colors.text.primary;
    };

    const getLastName = (fullName: string): string => {
        const parts = fullName.split(' ');
        return parts[parts.length - 1].toUpperCase();
    };

    const getTeamColor = (): string => {
        return driver.teamColor ? `#${driver.teamColor}` : theme.colors.primary.carbon;
    };

    const getAccentColor = (): string => {
        if (isFirst) return theme.colors.podium.gold;
        if (driver.position === 2) return theme.colors.podium.silver;
        if (driver.position === 3) return theme.colors.podium.bronze;
        return theme.colors.border.light;
    };

    return (
        <Animated.View
            style={[
                {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.card,
                    isFirst && styles.cardFirst,
                ]}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                {/* Left accent bar */}
                <View style={[styles.accentBar, { backgroundColor: getAccentColor() }]} />

                {/* Position */}
                <View style={styles.positionContainer}>
                    <Text style={[styles.positionText, { color: getPositionColor(driver) }]}>
                        {formatPosition(driver)}
                    </Text>
                </View>

                {/* Driver number badge */}
                <View style={[styles.driverNumber, { backgroundColor: getTeamColor() }]}>
                    <Text style={styles.driverNumberText}>{driver.driverNumber}</Text>
                </View>

                {/* Driver info */}
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName} numberOfLines={1}>
                        {getLastName(driver.driverName)}
                    </Text>
                    <Text style={styles.teamName} numberOfLines={1}>
                        {driver.teamName}
                    </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    {/* Lap count */}
                    <View style={styles.statBox}>
                        <Ionicons
                            name="flag-outline"
                            size={14}
                            color={theme.colors.text.tertiary}
                        />
                        <Text style={styles.statValue}>{driver.lapCount}</Text>
                    </View>

                    {/* Fastest lap */}
                    <View style={styles.statBox}>
                        <Ionicons
                            name="speedometer-outline"
                            size={14}
                            color={theme.colors.primary.red}
                        />
                        <Text style={styles.fastestLapText}>
                            {driver.fastestLap || '-'}
                        </Text>
                    </View>
                </View>

                {/* Chevron */}
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.text.tertiary}
                />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.secondary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.sm,
        ...theme.shadows.sm,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        position: 'relative',
        overflow: 'hidden',
    },

    cardFirst: {
        backgroundColor: theme.colors.podium.gold + '08', // 8% opacity
        borderColor: theme.colors.podium.gold + '40', // 40% opacity
        borderWidth: 2,
        ...theme.shadows.md,
    },

    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },

    positionContainer: {
        width: 52,
        alignItems: 'center',
        marginLeft: theme.spacing.xs,
    },

    positionText: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.black,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    driverNumber: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.md,
        ...theme.shadows.sm,
    },

    driverNumberText: {
        color: theme.colors.neutral.white,
        fontWeight: theme.typography.fontWeight.black,
        fontSize: theme.typography.fontSize.base,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },

    driverInfo: {
        flex: 1,
        marginRight: theme.spacing.sm,
    },

    driverName: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: 2,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    teamName: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    statsContainer: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        marginRight: theme.spacing.sm,
    },

    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },

    statValue: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        fontVariant: ['tabular-nums'],
    },

    fastestLapText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.primary.red,
        fontVariant: ['tabular-nums'],
    },
});