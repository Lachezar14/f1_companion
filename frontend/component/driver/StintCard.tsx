import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stint } from '../../../backend/types';

interface StintCardProps {
    stint: Stint;
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

export default function StintCard({ stint }: StintCardProps) {
    return (
        <View style={styles.card}>
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
});