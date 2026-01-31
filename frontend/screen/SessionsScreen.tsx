import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Animated,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Meeting } from "../../backend/types";
import {fetchMeetingsByYear} from "../../backend/api/openf1";
import GPCard from "../component/gp/GPCard";


export default function SessionsScreen() {
    const [gps, setGps] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const headerAnim = React.useRef(new Animated.Value(0)).current;
    const listAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchGPs();

        // Animate header and list on mount
        Animated.sequence([
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(listAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const fetchGPs = async () => {
        try {
            setLoading(true);
            const res = await fetchMeetingsByYear(2025);
            setGps(res);
        } catch {
            setError('Failed to load GPs');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchGPs();
        setRefreshing(false);
    };

    const renderHeader = () => (
        <Animated.View
            style={[
                styles.headerContainer,
                {
                    opacity: headerAnim,
                    transform: [
                        {
                            translateY: headerAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-20, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            {/* Gradient Background */}
            <LinearGradient
                colors={[theme.colors.primary.red, theme.colors.primary.darkRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <View style={styles.headerContent}>
                    {/* Season Badge */}
                    <View style={styles.seasonBadge}>
                        <Ionicons name="calendar" size={16} color={theme.colors.neutral.white} />
                        <Text style={styles.seasonText}>2025 SEASON</Text>
                    </View>

                    {/* Main Title */}
                    <Text style={styles.headerTitle}>F1 Calendar</Text>
                    <Text style={styles.headerSubtitle}>
                        {gps.length} Grand Prix{gps.length !== 1 ? 'es' : ''}
                    </Text>

                    {/* Racing Stripes Decoration */}
                    <View style={styles.racingStripes}>
                        <View style={[styles.stripe, styles.stripe1]} />
                        <View style={[styles.stripe, styles.stripe2]} />
                        <View style={[styles.stripe, styles.stripe3]} />
                    </View>
                </View>
            </LinearGradient>

            {/* Stats Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statItem}>
                    <Ionicons
                        name="trophy-outline"
                        size={18}
                        color={theme.colors.primary.red}
                    />
                    <Text style={styles.statText}>24 Races</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Ionicons
                        name="people-outline"
                        size={18}
                        color={theme.colors.primary.red}
                    />
                    <Text style={styles.statText}>20 Drivers</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Ionicons
                        name="business-outline"
                        size={18}
                        color={theme.colors.primary.red}
                    />
                    <Text style={styles.statText}>10 Teams</Text>
                </View>
            </View>
        </Animated.View>
    );

    const renderGP = ({ item, index }: { item: Meeting; index: number }) => (
        <Animated.View
            style={{
                opacity: listAnim,
                transform: [
                    {
                        translateY: listAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0],
                        }),
                    },
                ],
            }}
        >
            <GPCard meeting={item} />
        </Animated.View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.colors.neutral.gray} />
            <Text style={styles.emptyTitle}>No Races Found</Text>
            <Text style={styles.emptySubtitle}>
                The calendar will be updated soon
            </Text>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <Animated.View
                    style={{
                        transform: [
                            {
                                rotate: headerAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '360deg'],
                                }),
                            },
                        ],
                    }}
                >
                    <Ionicons
                        name="speedometer"
                        size={48}
                        color={theme.colors.primary.red}
                    />
                </Animated.View>
                <Text style={styles.loadingText}>Loading F1 Calendar...</Text>
            </View>
        );
    }

    if (error && !gps.length) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="warning" size={48} color={theme.colors.semantic.danger} />
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <FlatList
                data={gps}
                keyExtractor={(item) => item.meeting_key.toString()}
                renderItem={renderGP}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.primary.red}
                        colors={[theme.colors.primary.red]}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },

    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background.primary,
    },

    loadingText: {
        marginTop: theme.spacing.base,
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.medium,
        color: theme.colors.text.secondary,
    },

    errorTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.xs,
    },

    errorText: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        textAlign: 'center',
    },

    headerContainer: {
        marginBottom: theme.spacing.lg,
    },

    headerGradient: {
        paddingTop: theme.spacing['3xl'],
        paddingBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.base,
        position: 'relative',
        overflow: 'hidden',
    },

    headerContent: {
        position: 'relative',
        zIndex: 1,
    },

    seasonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        marginBottom: theme.spacing.md,
    },

    seasonText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        letterSpacing: theme.typography.letterSpacing.wider,
        marginLeft: theme.spacing.xs,
    },

    headerTitle: {
        fontSize: theme.typography.fontSize['5xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.neutral.white,
        letterSpacing: theme.typography.letterSpacing.tight,
        marginBottom: theme.spacing.xs,
    },

    headerSubtitle: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.medium,
        color: 'rgba(255, 255, 255, 0.8)',
    },

    racingStripes: {
        position: 'absolute',
        right: -20,
        top: 20,
        opacity: 0.1,
    },

    stripe: {
        width: 120,
        height: 4,
        backgroundColor: theme.colors.neutral.white,
        marginBottom: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
    },

    stripe1: {
        width: 120,
    },

    stripe2: {
        width: 100,
    },

    stripe3: {
        width: 80,
    },

    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: theme.colors.background.secondary,
        marginHorizontal: theme.spacing.base,
        marginTop: -theme.spacing.lg,
        paddingVertical: theme.spacing.base,
        borderRadius: theme.borderRadius.lg,
        ...theme.shadows.md,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },

    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },

    statText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
    },

    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: theme.colors.border.light,
    },

    listContent: {
        paddingHorizontal: theme.spacing.base,
        paddingBottom: theme.spacing.xl,
    },

    emptyContainer: {
        alignItems: 'center',
        paddingVertical: theme.spacing['4xl'],
    },

    emptyTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginTop: theme.spacing.base,
        marginBottom: theme.spacing.xs,
    },

    emptySubtitle: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.tertiary,
    },
});