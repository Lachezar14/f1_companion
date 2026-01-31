import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    DriverRaceOverview,
    getDriverRaceOverview,
    formatLapTime,
} from '../../backend/service/openf1Service';
import { Lap, Stint } from '../../backend/types';
import RaceStatsSection from "../component/driver/RaceStatsSection";
import StintCard from "../component/driver/StintCard";
import LapCard from "../component/driver/LapCard";
import { theme } from '../../theme';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
};

interface DriverState {
    data: DriverRaceOverview | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

type RaceResult = DriverRaceOverview['raceResult'];

const formatRaceResult = (raceResult: RaceResult): string => {
    if (!raceResult) return '-';
    if (raceResult.dnf) return 'DNF';
    if (raceResult.dsq) return 'DSQ';
    if (raceResult.dns) return 'DNS';
    if (raceResult.position) return `P${raceResult.position}`;
    return '-';
};

const getResultAccent = (raceResult: RaceResult): string => {
    if (!raceResult) return theme.colors.neutral.white;
    if (raceResult.dnf || raceResult.dsq || raceResult.dns) {
        return theme.colors.semantic.warning;
    }
    if (raceResult.position === 1) return theme.colors.podium.gold;
    if (raceResult.position === 2) return theme.colors.podium.silver;
    if (raceResult.position === 3) return theme.colors.podium.bronze;
    if (raceResult.position && raceResult.position <= 10) {
        return theme.colors.semantic.info;
    }
    return theme.colors.neutral.white;
};

export default function DriverOverviewScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { driverNumber, sessionKey } = route.params;

    const [state, setState] = useState<DriverState>({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
    });

    const [expandedSections, setExpandedSections] = useState({
        stints: false,
        laps: false,
    });

    const bestLap = useMemo(() => {
        if (!state.data?.laps?.length) {
            return null;
        }

        let fastest: Lap | null = null;

        state.data.laps.forEach(lap => {
            if (!lap.lap_duration || lap.is_pit_out_lap) {
                return;
            }

            if (
                !fastest ||
                (fastest.lap_duration == null || lap.lap_duration < fastest.lap_duration)
            ) {
                fastest = lap;
            }
        });

        return fastest;
    }, [state.data]);

    const toggleSection = (section: 'stints' | 'laps') => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const fetchDriver = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const overview = await getDriverRaceOverview(sessionKey, driverNumber);

                if (!overview) {
                    setState({
                        data: null,
                        loading: false,
                        refreshing: false,
                        error: 'Driver data not found for this session',
                    });
                    return;
                }

                setState({
                    data: overview,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    data: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load driver data',
                });
            }
        },
        [driverNumber, sessionKey]
    );

    useEffect(() => {
        fetchDriver();
    }, [fetchDriver]);

    const handleRefresh = useCallback(() => fetchDriver(true), [fetchDriver]);

    // Collapsible Section Component
    const CollapsibleSection: React.FC<{
        title: string;
        count: number;
        isExpanded: boolean;
        onToggle: () => void;
        children: React.ReactNode;
    }> = ({ title, count, isExpanded, onToggle, children }) => {
        const animatedHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
        const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

        useEffect(() => {
            Animated.parallel([
                Animated.timing(animatedHeight, {
                    toValue: isExpanded ? 1 : 0,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(rotateAnim, {
                    toValue: isExpanded ? 1 : 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }, [isExpanded]);

        const rotation = rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '180deg'],
        });

        const maxHeight = animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 10000], // Large number to accommodate content
        });

        const opacity = animatedHeight.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.5, 1],
        });

        return (
            <View style={styles.accordion}>
                <TouchableOpacity
                    style={styles.accordionHeader}
                    onPress={onToggle}
                    activeOpacity={0.9}
                >
                    <View style={styles.accordionTitleRow}>
                        <Text style={styles.accordionTitle}>{title}</Text>
                        <View style={styles.accordionCountBadge}>
                            <Text style={styles.accordionCountText}>{count}</Text>
                        </View>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons
                            name="chevron-down"
                            size={18}
                            color={theme.colors.text.secondary}
                        />
                    </Animated.View>
                </TouchableOpacity>

                <Animated.View
                    style={[
                        styles.accordionContentWrapper,
                        {
                            maxHeight,
                            opacity,
                        }
                    ]}
                >
                    <View style={styles.accordionContent}>{children}</View>
                </Animated.View>
            </View>
        );
    };

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.colors.primary.red} />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error || !state.data) {
        return (
            <View style={styles.center}>
                <Ionicons
                    name="alert-circle"
                    size={42}
                    color={theme.colors.semantic.danger}
                />
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const driver_overview = state.data;
    const bestLapTime = bestLap?.lap_duration ? formatLapTime(bestLap.lap_duration) : null;
    const bestLapMeta = bestLap?.lap_number ? `Lap ${bestLap.lap_number}` : null;
    const heroAccent = getResultAccent(driver_overview.raceResult);
    const heroResultLabel = formatRaceResult(driver_overview.raceResult);

    const quickStats = [
        {
            key: 'laps',
            label: 'Laps',
            value: driver_overview.lap_count.toString(),
            icon: 'flag-outline',
            accent: theme.colors.semantic.info,
        },
        {
            key: 'stints',
            label: 'Stints',
            value: driver_overview.stint_count.toString(),
            icon: 'flash-outline',
            accent: theme.colors.semantic.warning,
        },
        {
            key: 'best',
            label: 'Best Lap',
            value: bestLapTime || '-',
            meta: bestLapMeta ?? 'No clean lap',
            icon: 'timer-outline',
            accent: theme.colors.semantic.success,
        },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primary.red}
                    colors={[theme.colors.primary.red]}
                />
            }
        >
            <LinearGradient
                colors={[theme.colors.primary.carbon, theme.colors.primary.darkRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
            >
                <View style={styles.heroHeader}>
                    <View style={styles.heroTextGroup}>
                        <View style={styles.heroBadge}>
                            <Ionicons
                                name="speedometer"
                                size={14}
                                color={theme.colors.neutral.white}
                            />
                            <Text style={styles.heroBadgeText}>Driver Overview</Text>
                        </View>
                        <Text style={styles.heroName}>{driver_overview.driver.name}</Text>
                        <Text style={styles.heroTeam}>{driver_overview.driver.team}</Text>
                    </View>
                    <View style={[styles.heroNumberBadge, { borderColor: heroAccent }]}>
                        <Text style={styles.heroNumber}>#{driver_overview.driver.number}</Text>
                    </View>
                </View>

                <View style={styles.heroMetaRow}>
                    <View style={styles.heroMetaItem}>
                        <Text style={styles.heroMetaLabel}>Result</Text>
                        <Text style={[styles.heroMetaValue, { color: heroAccent }]}>
                            {heroResultLabel}
                        </Text>
                    </View>
                    <View style={styles.heroMetaDivider} />
                    <View style={styles.heroMetaItem}>
                        <Text style={styles.heroMetaLabel}>Best Lap</Text>
                        <Text style={styles.heroMetaValue}>{bestLapTime || '-'}</Text>
                        {bestLapMeta && <Text style={styles.heroMetaSub}>{bestLapMeta}</Text>}
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.quickStatsRow}>
                {quickStats.map(stat => {
                    const badgeColor = `${stat.accent}22`;
                    return (
                        <View key={stat.key} style={styles.quickStatCard}>
                            <View style={[styles.quickStatIcon, { backgroundColor: badgeColor }]}>
                                <Ionicons name={stat.icon} size={16} color={stat.accent} />
                            </View>
                            <Text style={styles.quickStatLabel}>{stat.label}</Text>
                            <Text style={styles.quickStatValue}>{stat.value}</Text>
                            {stat.meta && <Text style={styles.quickStatMeta}>{stat.meta}</Text>}
                        </View>
                    );
                })}
            </View>

            <RaceStatsSection
                raceResult={driver_overview.raceResult}
                lapCount={driver_overview.lap_count}
                stintCount={driver_overview.stint_count}
                laps={driver_overview.laps}
                stints={driver_overview.stints}
            />

            <CollapsibleSection
                title="Stints"
                count={driver_overview.stint_count}
                isExpanded={expandedSections.stints}
                onToggle={() => toggleSection('stints')}
            >
                {driver_overview.stints.length > 0 ? (
                    driver_overview.stints.map((stint: Stint, idx) => (
                        <View key={`${stint.lap_start}-${idx}`} style={styles.listItem}>
                            <StintCard stint={stint} />
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Stints data not available</Text>
                )}
            </CollapsibleSection>

            <CollapsibleSection
                title="Laps"
                count={driver_overview.lap_count}
                isExpanded={expandedSections.laps}
                onToggle={() => toggleSection('laps')}
            >
                {driver_overview.laps.length > 0 ? (
                    driver_overview.laps.map((lap: Lap, idx) => {
                        const currentStint = driver_overview.stints.find(
                            (stint: Stint) =>
                                lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
                        );

                        return (
                            <View key={`${lap.lap_number}-${idx}`} style={styles.listItem}>
                                <LapCard lap={lap} currentStint={currentStint} index={idx} />
                            </View>
                        );
                    })
                ) : (
                    <Text style={styles.noData}>Lap times not available</Text>
                )}
            </CollapsibleSection>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    content: {
        paddingBottom: theme.spacing['3xl'],
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing['2xl'],
        backgroundColor: theme.colors.background.primary,
    },
    loadingText: {
        marginTop: theme.spacing.sm,
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
    },
    errorTitle: {
        marginTop: theme.spacing.md,
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
    },
    errorMessage: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        textAlign: 'center',
    },
    hero: {
        margin: theme.spacing.base,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing['2xl'],
        ...theme.shadows.lg,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing.base,
    },
    heroTextGroup: {
        flex: 1,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        marginBottom: theme.spacing.sm,
    },
    heroBadgeText: {
        marginLeft: theme.spacing.xs,
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.xs,
        letterSpacing: theme.typography.letterSpacing.wide,
        fontWeight: theme.typography.fontWeight.semibold,
    },
    heroName: {
        fontSize: theme.typography.fontSize['4xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.neutral.white,
        letterSpacing: theme.typography.letterSpacing.tight,
    },
    heroTeam: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.base,
        color: 'rgba(255,255,255,0.8)',
    },
    heroNumberBadge: {
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.full,
        borderWidth: 1,
    },
    heroNumber: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.neutral.white,
        letterSpacing: theme.typography.letterSpacing.wider,
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing['2xl'],
    },
    heroMetaItem: {
        flex: 1,
    },
    heroMetaLabel: {
        fontSize: theme.typography.fontSize.xs,
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
        marginBottom: theme.spacing.xs,
    },
    heroMetaValue: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.neutral.white,
    },
    heroMetaSub: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    heroMetaDivider: {
        width: 1,
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: theme.spacing.base,
    },
    quickStatsRow: {
        flexDirection: 'row',
        gap: theme.spacing.base,
        paddingHorizontal: theme.spacing.base,
        marginTop: theme.spacing.base,
    },
    quickStatCard: {
        flex: 1,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.base,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        ...theme.shadows.sm,
    },
    quickStatIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    quickStatLabel: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },
    quickStatValue: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
    },
    quickStatMeta: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
    },
    accordion: {
        marginTop: theme.spacing['2xl'],
        marginHorizontal: theme.spacing.base,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        ...theme.shadows.md,
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.lg,
    },
    accordionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    accordionTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
    },
    accordionCountBadge: {
        minWidth: 36,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.background.tertiary,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
    },
    accordionCountText: {
        textAlign: 'center',
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
    },
    accordionContentWrapper: {
        overflow: 'hidden',
    },
    accordionContent: {
        padding: theme.spacing.base,
    },
    listItem: {
        marginBottom: theme.spacing.md,
    },
    noData: {
        textAlign: 'center',
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        paddingVertical: theme.spacing.lg,
    },
});
