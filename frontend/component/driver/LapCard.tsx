import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';

interface LapCardProps {
    lap: Lap;
    currentStint?: Stint;
    isPitIn?: boolean;
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

export default function LapCard({ lap, currentStint, isPitIn = false }: LapCardProps) {
    const compound = currentStint?.compound || 'Unknown';

    return (
        <View
            style={[
                styles.card,
                lap.is_pit_out_lap && styles.pitOutCard,
            ]}
        >
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.cardTitle}>Lap {lap.lap_number}</Text>
                    <View style={styles.statusRow}>
                        {lap.is_pit_out_lap && (
                            <View style={[styles.statusBadge, styles.pitOutBadge]}>
                                <Ionicons name="build-outline" size={12} color="#E10600" />
                                <Text style={[styles.statusText, styles.pitOutText]}>Pit Out</Text>
                            </View>
                        )}
                        {isPitIn && (
                            <View style={[styles.statusBadge, styles.pitInBadge]}>
                                <Ionicons name="log-in-outline" size={12} color="#0D47A1" />
                                <Text style={[styles.statusText, styles.pitInText]}>Pit In</Text>
                            </View>
                        )}
                    </View>
                </View>
                <Text style={styles.lapTime}>{formatLapTime(lap.lap_duration)}</Text>
            </View>

            <View style={styles.compoundRow}>
                <View
                    style={[
                        styles.compoundCircle,
                        { backgroundColor: getCompoundColor(compound) }
                    ]}
                >
                    <Text style={styles.compoundLetter}>{getCompoundLetter(compound)}</Text>
                </View>
                <Text style={styles.compoundLabel}>{compound}</Text>
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
}

const styles = StyleSheet.create({
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
        marginBottom: 6,
    },
    lapTime: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pitOutBadge: {
        backgroundColor: '#FFE0E0',
    },
    pitOutText: {
        color: '#E10600',
    },
    pitInBadge: {
        backgroundColor: '#E3F2FD',
    },
    pitInText: {
        color: '#0D47A1',
    },
    compoundRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    compoundCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compoundLetter: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    compoundLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        textTransform: 'capitalize',
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
});
