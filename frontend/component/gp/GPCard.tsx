import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient'; // You'll need: expo install expo-linear-gradient
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import {Meeting} from "../../../backend/types";

interface GPCardProps {
    meeting: Meeting;
}

type NavigationProp = any;

export default function GPCard({ meeting }: GPCardProps) {
    const navigation = useNavigation<NavigationProp>();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = () => {
        navigation.navigate('GPScreen', { gpKey: meeting.meeting_key });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    // Determine if race is upcoming, current, or past
    const now = new Date();
    const raceStart = new Date(meeting.date_start);
    const raceEnd = new Date(meeting.date_end);
    const isUpcoming = raceStart > now;
    const isCurrent = raceStart <= now && raceEnd >= now;
    const isPast = raceEnd < now;

    return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                style={styles.cardContainer}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                {/* Racing stripe accent */}
                <View
                    style={[
                        styles.racingStripe,
                        isCurrent && styles.racingStripeLive,
                        isPast && styles.racingStripePast,
                    ]}
                />

                {/* Card Content */}
                <View style={styles.card}>
                    {/* Header Section */}
                    <View style={styles.cardHeader}>
                        {/* Country Flag */}
                        <View style={styles.flagContainer}>
                            <Image
                                source={{ uri: meeting.country_flag }}
                                style={styles.flag}
                                resizeMode="cover"
                            />
                            {isCurrent && (
                                <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>LIVE</Text>
                                </View>
                            )}
                        </View>

                        {/* Race Info */}
                        <View style={styles.headerContent}>
                            <View style={styles.headerTop}>
                                <Text style={styles.raceName} numberOfLines={1}>
                                    {meeting.meeting_name}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={theme.colors.text.tertiary}
                                />
                            </View>

                            <View style={styles.locationRow}>
                                <Ionicons
                                    name="location-outline"
                                    size={14}
                                    color={theme.colors.text.secondary}
                                />
                                <Text style={styles.circuitName} numberOfLines={1}>
                                    {meeting.circuit_short_name}
                                </Text>
                            </View>

                            <Text style={styles.countryName}>{meeting.country_name}</Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Footer Section */}
                    <View style={styles.cardFooter}>
                        <View style={styles.dateContainer}>
                            <Ionicons
                                name="calendar-outline"
                                size={16}
                                color={theme.colors.text.secondary}
                            />
                            <Text style={styles.dateText}>
                                {formatDate(meeting.date_start)}
                                {meeting.date_start !== meeting.date_end &&
                                    ` - ${formatDate(meeting.date_end)}`}
                            </Text>
                        </View>

                        {/* Status Indicator */}
                        <View style={styles.statusContainer}>
                            {isUpcoming && (
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>Upcoming</Text>
                                </View>
                            )}
                            {isCurrent && (
                                <View style={[styles.statusBadge, styles.statusBadgeLive]}>
                                    <Text style={[styles.statusText, styles.statusTextLive]}>
                                        Live
                                    </Text>
                                </View>
                            )}
                            {isPast && (
                                <View style={[styles.statusBadge, styles.statusBadgePast]}>
                                    <Text style={styles.statusText}>Finished</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Decorative corner accent */}
                <View style={styles.cornerAccent} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: theme.spacing.base,
        position: 'relative',
    },

    racingStripe: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: theme.colors.primary.red,
        borderTopLeftRadius: theme.borderRadius.lg,
        borderBottomLeftRadius: theme.borderRadius.lg,
        zIndex: 2,
    },

    racingStripeLive: {
        backgroundColor: theme.colors.semantic.success,
    },

    racingStripePast: {
        backgroundColor: theme.colors.neutral.gray,
    },

    card: {
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.base,
        paddingLeft: theme.spacing.lg,
        ...theme.shadows.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        overflow: 'hidden',
    },

    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },

    flagContainer: {
        position: 'relative',
        marginRight: theme.spacing.md,
    },

    flag: {
        width: 56,
        height: 40,
        borderRadius: theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    liveBadge: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.semantic.success,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: theme.borderRadius.sm,
        ...theme.shadows.sm,
    },

    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.neutral.white,
        marginRight: 4,
    },

    liveText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    headerContent: {
        flex: 1,
    },

    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },

    raceName: {
        flex: 1,
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        letterSpacing: theme.typography.letterSpacing.tight,
    },

    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },

    circuitName: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
        marginLeft: theme.spacing.xs,
        flex: 1,
    },

    countryName: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
        fontWeight: theme.typography.fontWeight.regular,
    },

    divider: {
        height: 1,
        backgroundColor: theme.colors.border.light,
        marginVertical: theme.spacing.md,
    },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    dateText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
        marginLeft: theme.spacing.xs,
    },

    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    statusBadge: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.neutral.lightGray,
    },

    statusBadgeLive: {
        backgroundColor: theme.colors.semantic.success + '20', // 20% opacity
    },

    statusBadgePast: {
        backgroundColor: theme.colors.neutral.lightGray,
    },

    statusText: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    statusTextLive: {
        color: theme.colors.semantic.success,
    },

    cornerAccent: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        backgroundColor: theme.colors.primary.red + '08', // 8% opacity
        borderTopRightRadius: theme.borderRadius.lg,
        borderBottomLeftRadius: theme.borderRadius.lg,
    },
});