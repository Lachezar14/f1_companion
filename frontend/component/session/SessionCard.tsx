import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Session } from '../../../backend/types';
import { theme } from '../../../theme';

interface SessionCardProps {
    session: Session;
    meetingName?: string;
    index?: number; // For staggered animations
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function SessionCard({ session, meetingName, index = 0 }: SessionCardProps) {
    const navigation = useNavigation<NavigationProp>();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: index * 80,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
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
        navigation.navigate('FreePracticeScreen', {
            sessionKey: session.session_key,
            sessionName: session.session_name,
            meetingName: meetingName,
        });
    };

    /**
     * Get icon and styling for session type
     */
    const getSessionStyle = (sessionName: string) => {
        const name = sessionName.toLowerCase();

        if (name.includes('practice')) {
            return {
                icon: 'car-sport' as const,
                color: theme.colors.semantic.info,
                gradient: [theme.colors.semantic.info + '20', theme.colors.semantic.info + '05'],
                label: 'Practice',
            };
        }

        if (name.includes('qualifying') || name.includes('sprint shootout')) {
            return {
                icon: 'timer' as const,
                color: theme.colors.semantic.warning,
                gradient: [theme.colors.semantic.warning + '20', theme.colors.semantic.warning + '05'],
                label: 'Qualifying',
            };
        }

        if (name.includes('sprint')) {
            return {
                icon: 'flash' as const,
                color: '#FF6B00',
                gradient: ['#FF6B0020', '#FF6B0005'],
                label: 'Sprint',
            };
        }

        if (name.includes('race')) {
            return {
                icon: 'trophy' as const,
                color: theme.colors.primary.red,
                gradient: [theme.colors.primary.red + '20', theme.colors.primary.red + '05'],
                label: 'Race',
            };
        }

        return {
            icon: 'calendar' as const,
            color: theme.colors.neutral.gray,
            gradient: [theme.colors.neutral.gray + '20', theme.colors.neutral.gray + '05'],
            label: 'Session',
        };
    };

    /**
     * Format session date/time
     */
    const formatSessionDateTime = (dateStart: string): {
        date: string;
        time: string;
    } => {
        const date = new Date(dateStart);
        return {
            date: date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            }),
            time: date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        };
    };

    const sessionStyle = getSessionStyle(session.session_name);
    const dateTime = formatSessionDateTime(session.date_start);

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
                style={styles.card}
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                {/* Left accent bar */}
                <View style={[styles.accentBar, { backgroundColor: sessionStyle.color }]} />

                {/* Icon container with gradient */}
                <View style={styles.iconContainer}>
                    <LinearGradient
                        colors={sessionStyle.gradient}
                        style={styles.iconGradient}
                    >
                        <Ionicons
                            name={sessionStyle.icon}
                            size={28}
                            color={sessionStyle.color}
                        />
                    </LinearGradient>
                </View>

                {/* Session info */}
                <View style={styles.sessionInfo}>
                    {/* Session type badge */}
                    <View style={styles.sessionHeader}>
                        <View
                            style={[
                                styles.sessionBadge,
                                { backgroundColor: sessionStyle.color + '20' },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.sessionBadgeText,
                                    { color: sessionStyle.color },
                                ]}
                            >
                                {sessionStyle.label.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Session name */}
                    <Text style={styles.sessionName} numberOfLines={1}>
                        {session.session_name}
                    </Text>

                    {/* Date and time */}
                    <View style={styles.dateTimeContainer}>
                        <View style={styles.dateTime}>
                            <Ionicons
                                name="calendar-outline"
                                size={14}
                                color={theme.colors.text.tertiary}
                            />
                            <Text style={styles.dateText}>{dateTime.date}</Text>
                        </View>
                        <View style={styles.dateTimeSeparator} />
                        <View style={styles.dateTime}>
                            <Ionicons
                                name="time-outline"
                                size={14}
                                color={theme.colors.text.tertiary}
                            />
                            <Text style={styles.timeText}>{dateTime.time}</Text>
                        </View>
                    </View>
                </View>

                {/* Chevron */}
                <Ionicons
                    name="chevron-forward"
                    size={24}
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
        padding: theme.spacing.base,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.md,
        ...theme.shadows.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        position: 'relative',
        overflow: 'hidden',
    },

    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },

    iconContainer: {
        marginRight: theme.spacing.base,
        marginLeft: theme.spacing.xs,
    },

    iconGradient: {
        width: 56,
        height: 56,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.sm,
    },

    sessionInfo: {
        flex: 1,
    },

    sessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },

    sessionBadge: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.sm,
    },

    sessionBadgeText: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wider,
    },

    sessionName: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.sm,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    dateTime: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },

    dateTimeSeparator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.border.medium,
        marginHorizontal: theme.spacing.sm,
    },

    dateText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
    },

    timeText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
    },
});