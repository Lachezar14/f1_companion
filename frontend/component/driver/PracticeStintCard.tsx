import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';

interface PracticeStintCardProps {
    stint: Stint;
    laps: Lap[];
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

const getTyreStatus = (age: number): string => {
    if (age <= 0) {
        return 'New';
    }
    return age === 1 ? 'New (1 lap)' : `Used (${age} laps)`;
};

export default function PracticeStintCard({ stint, laps }: PracticeStintCardProps) {
    const sortedLaps = [...laps].sort((a, b) => a.lap_number - b.lap_number);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>Stint {stint.stint_number}</Text>
                    <View
                        style={[
                            styles.compoundCircle,
                            { backgroundColor: getCompoundColor(stint.compound) }
                        ]}
                    >
                        <Text style={styles.compoundCircleText}>
                            {getCompoundLetter(stint.compound)}
                        </Text>
                    </View>
                    <Text style={styles.compoundLabel}>{stint.compound}</Text>
                </View>
                <Text style={styles.lapRange}>
                    Laps {stint.lap_start} - {stint.lap_end}
                </Text>
            </View>

            <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                    Tyre age: {getTyreStatus(stint.tyre_age_at_start)}
                </Text>
                <Text style={styles.metaText}>
                    Total laps: {stint.lap_end - stint.lap_start + 1}
                </Text>
            </View>

            <View style={styles.lapTable}>
                <View style={[styles.lapRow, styles.lapHeaderRow]}>
                    <Text style={[styles.lapCell, styles.headerCell]}>Lap</Text>
                    <Text style={[styles.timeCell, styles.headerCell]}>Time</Text>
                    <Text style={[styles.noteCell, styles.headerCell]}>Note</Text>
                </View>
                {sortedLaps.length > 0 ? (
                    sortedLaps.map(lap => (
                        <View key={lap.lap_number} style={styles.lapRow}>
                            <Text style={styles.lapCell}>#{lap.lap_number}</Text>
                            <Text style={styles.timeCell}>
                                {formatLapTime(lap.lap_duration)}
                            </Text>
                            <Text style={[styles.noteCell, lap.is_pit_out_lap && styles.noteHighlight]}>
                                {lap.is_pit_out_lap ? 'Out lap' : ''}
                            </Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No laps recorded for this stint</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E10600',
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
    compoundLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        textTransform: 'capitalize',
    },
    lapRange: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    metaText: {
        fontSize: 13,
        color: '#666',
    },
    lapTable: {
        borderWidth: 1,
        borderColor: '#F0F0F0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    lapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    lapHeaderRow: {
        backgroundColor: '#FAFAFA',
    },
    lapCell: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    timeCell: {
        flex: 1,
        fontSize: 14,
        color: '#E10600',
        fontWeight: '600',
    },
    noteCell: {
        flex: 1,
        fontSize: 13,
        color: '#999',
        textAlign: 'right',
    },
    headerCell: {
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#666',
    },
    noteHighlight: {
        color: '#E10600',
        fontWeight: '700',
    },
    emptyState: {
        padding: 12,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#999',
        fontStyle: 'italic',
    },
});
