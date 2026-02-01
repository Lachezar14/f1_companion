import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';

interface PracticeStatsSectionProps {
    lapCount: number;
    stints: Stint[];
    laps: Lap[];
}

type CompoundStat = {
    compound: string;
    avgTime: number;
    lapCount: number;
};

const ALLOWED_LAP_DELTA_SECONDS = 5;

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

const calculateTypicalLapDuration = (laps: Lap[]): number | null => {
    const sortedDurations = laps
        .filter(lap => !lap.is_pit_out_lap && lap.lap_duration && lap.lap_duration > 0)
        .map(lap => lap.lap_duration as number)
        .sort((a, b) => a - b);

    if (!sortedDurations.length) {
        return null;
    }

    const middle = Math.floor(sortedDurations.length / 2);
    if (sortedDurations.length % 2 === 0) {
        return (sortedDurations[middle - 1] + sortedDurations[middle]) / 2;
    }
    return sortedDurations[middle];
};

const calculateAvgLapTimePerCompound = (
    laps: Lap[],
    stints: Stint[],
    lapThreshold: number | null,
): CompoundStat[] => {
    const compoundMap = new Map<string, { total: number; count: number }>();

    laps.forEach(lap => {
        if (lap.is_pit_out_lap || !lap.lap_duration) {
            return;
        }

        if (lapThreshold !== null && lap.lap_duration > lapThreshold) {
            return;
        }

        const stint = stints.find(s => lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end);
        if (!stint) {
            return;
        }

        const compound = stint.compound;
        const entry = compoundMap.get(compound) || { total: 0, count: 0 };
        compoundMap.set(compound, {
            total: entry.total + lap.lap_duration,
            count: entry.count + 1,
        });
    });

    return Array.from(compoundMap.entries()).map(([compound, data]) => ({
        compound,
        avgTime: data.total / data.count,
        lapCount: data.count,
    }));
};

const getFastestLap = (laps: Lap[]): number | null => {
    let fastest: number | null = null;
    laps.forEach(lap => {
        if (!lap.lap_duration || lap.lap_duration <= 0) {
            return;
        }
        if (fastest === null || lap.lap_duration < fastest) {
            fastest = lap.lap_duration;
        }
    });
    return fastest;
};

export default function PracticeStatsSection({ lapCount, stints, laps }: PracticeStatsSectionProps) {
    const typicalLapDuration = calculateTypicalLapDuration(laps);
    // Filter out cool-down / red flag laps that are >10s slower than the session's median pace
    const lapThreshold = typicalLapDuration !== null ? typicalLapDuration + ALLOWED_LAP_DELTA_SECONDS : null;

    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints, lapThreshold).sort(
        (a, b) => b.lapCount - a.lapCount
    );
    const fastestLap = getFastestLap(laps);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Free Practice Summary</Text>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Ionicons name="flag-outline" size={24} color="#E10600" />
                    <Text style={styles.statValue}>{lapCount}</Text>
                    <Text style={styles.statLabel}>Laps</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statBox}>
                    <Ionicons name="git-branch-outline" size={24} color="#E10600" />
                    <Text style={styles.statValue}>{stints.length}</Text>
                    <Text style={styles.statLabel}>Stints</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statBox}>
                    <Ionicons name="speedometer-outline" size={24} color="#E10600" />
                    <Text style={styles.statValue}>
                        {fastestLap ? formatLapTime(fastestLap) : '-'}
                    </Text>
                    <Text style={styles.statLabel}>Fastest</Text>
                </View>
            </View>

            {avgLapTimesPerCompound.length > 0 && (
                <View style={styles.compoundSection}>
                    <Text style={styles.compoundTitle}>Tyre Compounds</Text>
                    {avgLapTimesPerCompound.map(stat => (
                        <View key={stat.compound} style={styles.compoundRow}>
                            <View style={styles.compoundInfo}>
                                <View
                                    style={[
                                        styles.compoundCircle,
                                        { backgroundColor: getCompoundColor(stat.compound) }
                                    ]}
                                >
                                    <Text style={styles.compoundCircleText}>
                                        {getCompoundLetter(stat.compound)}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.compoundName}>
                                        {stat.compound}
                                    </Text>
                                    <Text style={styles.compoundLapCount}>
                                        {stat.lapCount} {stat.lapCount === 1 ? 'lap' : 'laps'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.compoundTime}>
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
    container: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
    },
    statDivider: {
        width: 1,
        height: 56,
        backgroundColor: '#E8E8E8',
    },
    compoundSection: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 16,
    },
    compoundTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    compoundRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    compoundInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    compoundCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compoundCircleText: {
        color: '#FFF',
        fontWeight: '700',
    },
    compoundName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        textTransform: 'capitalize',
    },
    compoundLapCount: {
        fontSize: 13,
        color: '#999',
    },
    compoundTime: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E10600',
    },
});
