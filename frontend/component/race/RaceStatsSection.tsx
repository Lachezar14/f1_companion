import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint, PitStop } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import { getCompoundColor, getCompoundLetter } from '../../../utils/tyre';
import { calculateAvgLapTimePerCompound } from '../../../utils/lap';

interface RaceStatsSectionProps {
    raceResult: any;
    lapCount: number;
    laps: Lap[];
    stints: Stint[];
    pitStops: PitStop[];
    safetyCarLapSet?: Set<number>;
}

export default function RaceStatsSection({
    raceResult,
    lapCount,
    laps,
    stints,
    pitStops,
    safetyCarLapSet,
}: RaceStatsSectionProps) {
    const pitStopCount = pitStops?.length ?? 0;
    const avgPitStopDuration = (() => {
        if (!pitStopCount) return null;
        const durations = pitStops
            .map(stop => stop.stop_duration)
            .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
        if (!durations.length) return null;
        const sum = durations.reduce((total, duration) => total + duration, 0);
        return sum / durations.length;
    })();

    const avgLapTimesPerCompound = calculateAvgLapTimePerCompound(laps, stints, {
        excludedLapNumbers: safetyCarLapSet,
    }).sort((a, b) => b.lapCount - a.lapCount);

    const statCards: {
        key: string;
        label: string;
        value: string | number;
        icon: keyof typeof Ionicons.glyphMap;
        tint: string;
        accent: string;
    }[] = [
        /*{ key: 'result', label: 'Result', value: formattedRaceResult, icon: 'trophy', tint: 'rgba(109,225,156,0.18)', accent: '#6DE19C' },*/
        { key: 'pitStops', label: 'Pit Stops', value: pitStopCount, icon: 'build', tint: 'rgba(255,138,92,0.15)', accent: '#FF8A5C' },
        {
            key: 'avgPitStop',
            label: 'Avg Pit Stop',
            value: avgPitStopDuration ? `${avgPitStopDuration.toFixed(2)}s` : '—',
            icon: 'timer-outline',
            tint: 'rgba(131,146,255,0.18)',
            accent: '#8392FF',
        },
        { key: 'laps', label: 'Laps', value: lapCount, icon: 'flag', tint: 'rgba(62,197,255,0.2)', accent: '#3EC5FF' },
    ];

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.overline}>Grand Prix Detail</Text>
                <Text style={styles.title}>Race Stats</Text>
                <Text style={styles.subtitle}>Result, pit strategy and tyre averages</Text>
            </View>

            <View style={styles.statGrid}>
                {statCards.map(stat => (
                    <View key={stat.key} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: stat.tint }]}>
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
                        <Text style={styles.compoundTitle}>Average Lap Time by Compound</Text>
                        <Text style={styles.compoundSubtitle}>Ignoring pit exit laps & safety car tours</Text>
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
                            <View style={styles.pacePill}>
                                <Ionicons name="time-outline" size={14} color="#15151E" />
                                <Text style={styles.compoundStatTime}>
                                    {formatLapTime(stat.avgTime)}
                                </Text>
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
        marginTop: 20,
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
        letterSpacing: 1,
        fontWeight: '700',
        textTransform: 'uppercase',
        color: '#7C7C85',
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
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#7C7C85',
        fontWeight: '700',
    },
    statValue: {
        marginTop: 6,
        fontSize: 22,
        fontWeight: '700',
        color: '#15151E',
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
    compoundLetter: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    compoundName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
        textTransform: 'capitalize',
    },
    compoundLapCount: {
        fontSize: 13,
        color: '#8589A0',
        marginTop: 2,
    },
    pacePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        backgroundColor: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E1E4EF',
    },
    compoundStatTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
});
