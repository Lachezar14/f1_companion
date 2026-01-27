import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { DriverRaceOverview, formatLapTime, getDriverRaceOverview } from '../../backend/service/openf1Service';
import { Lap, Stint } from '../../backend/types';

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

// Helper function to get compound colors
const getCompoundColor = (compound: string): string => {
    const compoundLower = compound.toLowerCase();
    switch (compoundLower) {
        case 'soft':
            return '#E10600';
        case 'medium':
            return '#d8b031';
        case 'hard':
            return '#9E9E9E';
        case 'intermediate':
            return '#4CAF50';
        case 'wet':
            return '#2196F3';
        default:
            return '#666';
    }
};

// Helper function to format tyre status
const getTyreStatus = (tyreAge: number): string => {
    return tyreAge > 1 ? `Used (${tyreAge})` : `New (${tyreAge})`;
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
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={onToggle}
                    activeOpacity={0.7}
                >
                    <View style={styles.sectionTitleContainer}>
                        <Text style={styles.sectionTitle}>{title}</Text>
                        <Text style={styles.sectionCount}>: {count}</Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </Animated.View>
                </TouchableOpacity>

                <Animated.View
                    style={[
                        styles.sectionContentWrapper,
                        {
                            maxHeight,
                            opacity,
                        }
                    ]}
                >
                    <View style={styles.sectionContent}>
                        {children}
                    </View>
                </Animated.View>
            </View>
        );
    };

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error || !state.data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const driver_overview = state.data;

    // Calculate stats
    const pitStops = Math.max(0, driver_overview.stint_count - 1);
    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(
        driver_overview.laps,
        driver_overview.stints
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.name}>{driver_overview.driver.name}</Text>
                <Text style={styles.team}>{driver_overview.driver.team}</Text>
                <Text style={styles.number}>#{driver_overview.driver.number}</Text>
            </View>

            {/* Overall Stats Section */}
            <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Overall Stats</Text>

                {/* Key Stats Row */}
                <View style={styles.keyStatsRow}>
                    <View style={styles.statBox}>
                        <Ionicons name="flag" size={24} color="#E10600" />
                        <Text style={styles.statValue}>{driver_overview.lap_count}</Text>
                        <Text style={styles.statLabel}>Laps</Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                        <Ionicons name="build" size={24} color="#E10600" />
                        <Text style={styles.statValue}>{pitStops}</Text>
                        <Text style={styles.statLabel}>Pit Stops</Text>
                    </View>
                </View>

                {/* Average Lap Time Per Compound */}
                {avgLapTimesPerCompound.length > 0 && (
                    <View style={styles.compoundStatsContainer}>
                        <Text style={styles.compoundStatsTitle}>Average Lap Time by Compound</Text>
                        {avgLapTimesPerCompound.map((stat, idx) => (
                            <View key={idx} style={styles.compoundStatRow}>
                                <View style={styles.compoundStatLeft}>
                                    <View
                                        style={[
                                            styles.compoundDot,
                                            { backgroundColor: getCompoundColor(stat.compound) }
                                        ]}
                                    />
                                    <Text style={styles.compoundStatLabel}>
                                        {stat.compound}
                                    </Text>
                                    <Text style={styles.compoundStatLapCount}>
                                        ({stat.lapCount} laps)
                                    </Text>
                                </View>
                                <Text style={styles.compoundStatTime}>
                                    {formatLapTime(stat.avgTime)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Stints Section */}
            <CollapsibleSection
                title="Stints"
                count={driver_overview.stint_count}
                isExpanded={expandedSections.stints}
                onToggle={() => toggleSection('stints')}
            >
                {driver_overview.stints.length > 0 ? (
                    driver_overview.stints.map((stint: Stint, idx) => (
                        <View key={idx} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Stint {stint.stint_number}</Text>
                                <View style={[
                                    styles.compoundBadge,
                                    { backgroundColor: getCompoundColor(stint.compound) }
                                ]}>
                                    <Text style={styles.compoundText}>{stint.compound}</Text>
                                </View>
                            </View>
                            <View style={styles.cardRow}>
                                <Ionicons name="albums-outline" size={16} color="#666" />
                                <Text style={styles.cardDetail}>
                                    Tyres: {getTyreStatus(stint.tyre_age_at_start)}
                                </Text>
                            </View>
                            <View style={styles.cardRow}>
                                <Ionicons name="flag-outline" size={16} color="#666" />
                                <Text style={styles.cardDetail}>Laps: {stint.lap_start} - {stint.lap_end}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>Stints data not available</Text>
                )}
            </CollapsibleSection>

            {/* Laps Section */}
            <CollapsibleSection
                title="Laps"
                count={driver_overview.lap_count}
                isExpanded={expandedSections.laps}
                onToggle={() => toggleSection('laps')}
            >
                {driver_overview.laps.length > 0 ? (
                    driver_overview.laps.map((lap: Lap, idx) => {
                        // Find the stint for this lap
                        const currentStint = driver_overview.stints.find(
                            (stint: Stint) => lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end
                        );

                        return (
                            <View
                                key={idx}
                                style={[
                                    styles.card,
                                    lap.is_pit_out_lap && styles.pitOutCard,
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>Lap {lap.lap_number}</Text>
                                    <View style={styles.lapBadges}>
                                        {currentStint && (
                                            <View style={[
                                                styles.compoundBadgeSmall,
                                                { backgroundColor: getCompoundColor(currentStint.compound) }
                                            ]}>
                                                <Text style={styles.compoundTextSmall}>{currentStint.compound}</Text>
                                            </View>
                                        )}
                                        {lap.is_pit_out_lap && (
                                            <View style={styles.pitOutBadge}>
                                                <Ionicons name="build-outline" size={12} color="#E10600" />
                                                <Text style={styles.pitOutText}>Pit Out</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.cardRow}>
                                    <Ionicons name="time-outline" size={16} color="#666" />
                                    <Text style={styles.cardDetailBold}>{formatLapTime(lap.lap_duration)}</Text>
                                </View>
                                <View style={styles.sectorsContainer}>
                                    <View style={styles.sectorItem}>
                                        <Text style={styles.sectorLabel}>S1</Text>
                                        <Text style={styles.sectorValue}>{lap.duration_sector_1 ?? '-'}</Text>
                                    </View>
                                    <View style={styles.sectorDivider} />
                                    <View style={styles.sectorItem}>
                                        <Text style={styles.sectorLabel}>S2</Text>
                                        <Text style={styles.sectorValue}>{lap.duration_sector_2 ?? '-'}</Text>
                                    </View>
                                    <View style={styles.sectorDivider} />
                                    <View style={styles.sectorItem}>
                                        <Text style={styles.sectorLabel}>S3</Text>
                                        <Text style={styles.sectorValue}>{lap.duration_sector_3 ?? '-'}</Text>
                                    </View>
                                </View>
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
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#333' },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E10600', marginBottom: 8 },
    errorMessage: { fontSize: 16, color: '#333', textAlign: 'center' },
    header: {
        padding: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    name: { fontSize: 26, fontWeight: 'bold', color: '#E10600', marginBottom: 4 },
    team: { fontSize: 18, color: '#333', marginBottom: 4 },
    number: { fontSize: 18, fontWeight: '600', color: '#0c0c0c' },

    // Overall Stats Styles
    statsContainer: {
        margin: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    statsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 16,
    },
    keyStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    statDivider: {
        width: 1,
        height: 60,
        backgroundColor: '#E8E8E8',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#333',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    compoundStatsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 16,
    },
    compoundStatsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    compoundStatRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: '#FAFAFA',
        borderRadius: 8,
        marginBottom: 8,
    },
    compoundStatLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    compoundDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    compoundStatLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        textTransform: 'capitalize',
    },
    compoundStatLapCount: {
        fontSize: 13,
        color: '#999',
        marginLeft: 6,
    },
    compoundStatTime: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E10600',
    },

    section: {
        marginTop: 16,
        marginHorizontal: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FAFAFA',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
    sectionCount: { fontSize: 18, color: '#999', marginLeft: 6, fontWeight: '400' },
    sectionContent: {
        padding: 12,
    },
    sectionContentWrapper: {
        overflow: 'hidden',
    },
    card: {
        backgroundColor: '#FFF',
        padding: 16,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
    },
    pitOutCard: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FFE0E0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#E10600',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardDetail: {
        fontSize: 15,
        color: '#555',
        marginLeft: 8,
        fontWeight: '400',
    },
    cardDetailBold: {
        fontSize: 16,
        color: '#333',
        marginLeft: 8,
        fontWeight: '600',
    },
    compoundBadge: {
        backgroundColor: '#E10600',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    compoundText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    compoundBadgeSmall: {
        backgroundColor: '#E10600',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
        marginRight: 6,
    },
    compoundTextSmall: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    lapBadges: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pitOutBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFE0E0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    pitOutText: {
        color: '#E10600',
        fontSize: 12,
        fontWeight: '600',
    },
    sectorsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    sectorItem: {
        alignItems: 'center',
        flex: 1,
    },
    sectorLabel: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
        marginBottom: 4,
    },
    sectorValue: {
        fontSize: 15,
        color: '#333',
        fontWeight: '600',
    },
    sectorDivider: {
        width: 1,
        backgroundColor: '#E8E8E8',
        marginHorizontal: 8,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});