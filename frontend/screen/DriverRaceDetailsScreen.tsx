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
import { DriverRaceOverview, getDriverRaceOverview } from '../../backend/service/openf1Service';
import { Lap, Stint } from '../../backend/types';
import RaceStatsSection from "../component/driver/RaceStatsSection";
import StintCard from "../component/driver/StintCard";
import LapCard from "../component/driver/LapCard";

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

            {/* Race Stats Section - Now using RaceStatsSection component */}
            <RaceStatsSection
                raceResult={driver_overview.raceResult}
                lapCount={driver_overview.lap_count}
                stintCount={driver_overview.stint_count}
                laps={driver_overview.laps}
                stints={driver_overview.stints}
            />

            {/* Stints Section */}
            <CollapsibleSection
                title="Stints"
                count={driver_overview.stint_count}
                isExpanded={expandedSections.stints}
                onToggle={() => toggleSection('stints')}
            >
                {driver_overview.stints.length > 0 ? (
                    driver_overview.stints.map((stint: Stint, idx) => (
                        <StintCard key={idx} stint={stint} />
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
                            <LapCard
                                key={idx}
                                lap={lap}
                                currentStint={currentStint}
                            />
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
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 20,
        textAlign: 'center',
    },
});