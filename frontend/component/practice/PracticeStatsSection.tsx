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

export default function PracticeStatsSection({ lapCount, stints, laps }: PracticeStatsSectionProps) {
    const typicalLapDuration = calculateTypicalLapDuration(laps);
    const lapThreshold = typicalLapDuration !== null ? typicalLapDuration + ALLOWED_LAP_DELTA_SECONDS : null;

    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints, lapThreshold).sort(
        (a, b) => b.lapCount - a.lapCount
    );
    const compoundsUsed = new Set(stints.map(stint => stint.compound.toLowerCase())).size || '—';

    const statCards: { key: string; label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; tint: string; accent: string }[] = [
        {
            key: 'laps',
            label: 'Laps',
            value: lapCount,
            icon: 'flag-outline',
            tint: 'rgba(62,197,255,0.22)',
            accent: '#3EC5FF',
        },
        {
            key: 'stints',
            label: 'Stints',
            value: stints.length,
            icon: 'git-branch-outline',
            tint: 'rgba(255,138,92,0.2)',
            accent: '#FF8A5C',
        },
        /*{
            key: 'compounds',
            label: 'Compounds',
            value: compoundsUsed,
            icon: 'color-palette-outline',
            tint: 'rgba(172,140,255,0.2)',
            accent: '#AC8CFF',
        },*/
    ];

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.overline}>Practice Pace</Text>
                <Text style={styles.title}>Free Practice Summary</Text>
                <Text style={styles.subtitle}>Session totals, stint count and headline lap pace</Text>
            </View>

            <View style={styles.statGrid}>
                {statCards.map(stat => (
                    <View key={stat.key} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: stat.tint }]}
                        >
                            <Ionicons name={stat.icon} size={20} color={stat.accent} />
                        </View>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                        <Text style={styles.statValue}>{stat.value}</Text>
                    </View>
                ))}
            </View>

            {avgLapTimesPerCompound.length > 0 && (
                <View style={styles.compoundCard}>
                    <View style={styles.compoundHeader}>
                        <Text style={styles.compoundTitle}>Tyre Compounds</Text>
                        <Text style={styles.compoundSubtitle}>Average lap (excludes slow-down laps)</Text>
                    </View>
                    {avgLapTimesPerCompound.map((stat, index) => (
                        <View
                            key={stat.compound}
                            style={[
                                styles.compoundRow,
                                index === avgLapTimesPerCompound.length - 1 && styles.compoundRowLast,
                            ]}
                        >
                            <View style={styles.compoundInfo}>
                                <View
                                    style={[styles.compoundCircle, { backgroundColor: getCompoundColor(stat.compound) }]}
                                >
                                    <Text style={styles.compoundCircleText}>
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
                            <View style={styles.compoundPacePill}>
                                <Ionicons name="time-outline" size={14} color="#15151E" />
                                <Text style={styles.compoundTime}>{formatLapTime(stat.avgTime)}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.09,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
        elevation: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#EBEFF5',
    },
    header: {
        marginBottom: 20,
    },
    overline: {
        fontSize: 12,
        color: '#7C7C85',
        letterSpacing: 1,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        marginTop: 6,
        fontSize: 22,
        fontWeight: '700',
        color: '#15151E',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#7C7C85',
    },
    statGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        borderRadius: 18,
        padding: 16,
        backgroundColor: '#F7F8FA',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E8F0',
    },
    statIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    statLabel: {
        fontSize: 12,
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        color: '#7C7C85',
        fontWeight: '700',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#15151E',
        marginTop: 6,
    },
    compoundCard: {
        marginTop: 24,
        backgroundColor: '#F8F9FC',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DFE3EE',
    },
    compoundHeader: {
        marginBottom: 14,
    },
    compoundTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
    },
    compoundSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#81859A',
    },
    compoundRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#DDE1ED',
    },
    compoundRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    compoundInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    compoundCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
    },
    compoundCircleText: {
        color: '#FFF',
        fontWeight: '700',
    },
    compoundName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
        textTransform: 'capitalize',
    },
    compoundLapCount: {
        marginTop: 2,
        fontSize: 13,
        color: '#8589A0',
    },
    compoundPacePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E1E4EF',
    },
    compoundTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
});
