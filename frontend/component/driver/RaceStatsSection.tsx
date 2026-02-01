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
    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints);
    const formattedRaceResult = formatRaceResult(raceResult);
    return (
        <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Race Stats</Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Ionicons name="trophy" size={24} color="#E10600" />
                    <Text style={styles.statValue}>{formattedRaceResult}</Text>
                    <Text style={styles.statLabel}>Result</Text>
                </View>

                <View style={styles.statDividerVertical} />

                <View style={styles.statBox}>
                    <Ionicons name="flag" size={24} color="#E10600" />
                    <Text style={styles.statValue}>{lapCount}</Text>
                    <Text style={styles.statLabel}>Laps</Text>
                </View>

                <View style={styles.statDividerVertical} />

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
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    statDividerVertical: {
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
});
