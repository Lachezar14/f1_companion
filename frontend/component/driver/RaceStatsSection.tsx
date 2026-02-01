import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';

interface RaceStatsSectionProps {
    raceResult: any;
    lapCount: number;
    stintCount: number;
    laps: Lap[];
    stints: Stint[];
}

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

const getCompoundLetter = (compound: string): string => {
    const compoundLower = compound.toLowerCase();
    switch (compoundLower) {
        case 'soft':
            return 'S';
        case 'medium':
            return 'M';
        case 'hard':
            return 'H';
        case 'intermediate':
            return 'I';
        case 'wet':
            return 'W';
        default:
            return compoundLower.charAt(0).toUpperCase();
    }
};

// Helper function to format race result
const formatRaceResult = (raceResult: any): string => {
    if (!raceResult) return '-';

    // Check for DNF, DSQ, DNS statuses (boolean flags)
    if (raceResult.dnf) return 'DNF';
    if (raceResult.dsq) return 'DSQ';
    if (raceResult.dns) return 'DNS';

    // Return position if available
    if (raceResult.position) {
        return `P${raceResult.position}`;
    }

    return '-';
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

export default function RaceStatsSection({
                                             raceResult,
                                             lapCount,
                                             stintCount,
                                             laps,
                                             stints,
                                         }: RaceStatsSectionProps) {
    // Calculate stats internally
    const pitStops = Math.max(0, stintCount - 1);
    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints).sort(
        (a, b) => b.lapCount - a.lapCount
    );
    const formattedRaceResult = formatRaceResult(raceResult);
    return (
        <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Race Stats</Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <View style={styles.statIcon}>
                        <Ionicons name="trophy" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.statValue}>{formattedRaceResult}</Text>
                    <Text style={styles.statLabel}>Result</Text>
                </View>

                <View style={styles.statBox}>
                    <View style={styles.statIcon}>
                        <Ionicons name="build" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.statValue}>{pitStops}</Text>
                    <Text style={styles.statLabel}>Pit Stops</Text>
                </View>

                <View style={styles.statBox}>
                    <View style={styles.statIcon}>
                        <Ionicons name="flag" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.statValue}>{lapCount}</Text>
                    <Text style={styles.statLabel}>Laps</Text>
                </View>
            </View>

            {/* Average Lap Time Per Compound */}
            {avgLapTimesPerCompound.length > 0 && (
                <View style={styles.compoundStatsContainer}>
                    <Text style={styles.compoundStatsTitle}>Average Lap Time by Compound</Text>
                    {avgLapTimesPerCompound.map((stat, idx) => (
                        <View key={idx} style={styles.compoundStatRow}>
                            <View style={styles.compoundLeft}>
                                <View
                                    style={[
                                        styles.compoundCircle,
                                        { backgroundColor: getCompoundColor(stat.compound) }
                                    ]}
                                >
                                    <Text style={styles.compoundLetter}>
                                        {getCompoundLetter(stat.compound)}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.compoundName}>{stat.compound}</Text>
                                    <Text style={styles.compoundLapCount}>
                                        {stat.lapCount} {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.compoundStatTime}>
                                {formatLapTime(stat.avgTime)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
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
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E10600',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#333',
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
    compoundLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    compoundCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    compoundLetter: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    compoundName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        textTransform: 'capitalize',
    },
    compoundLapCount: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    compoundStatTime: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E10600',
    },
});
