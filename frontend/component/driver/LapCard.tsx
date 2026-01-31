import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../backend/service/openf1Service';

interface LapCardProps {
    lap: Lap;
    currentStint?: Stint;
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

export default function LapCard({ lap, currentStint }: LapCardProps) {
    return (
        <View
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
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardDetailBold: {
        fontSize: 16,
        color: '#333',
        marginLeft: 8,
        fontWeight: '600',
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
});