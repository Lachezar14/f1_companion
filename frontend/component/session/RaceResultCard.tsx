import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import type { RaceDriverClassification } from '../../../backend/types';

export type RaceResultCardProps = {
    data: RaceDriverClassification;
    onPress?: (driverNumber: number) => void;
    style?: ViewStyle;
};

const RaceResultCard: React.FC<RaceResultCardProps> = ({ data, onPress, style }) => {
    const handlePress = () => {
        if (onPress) {
            onPress(data.driverNumber);
        }
    };

    const formatPosition = (): string => {
        return data.position ? `P${data.position}` : '-';
    };

    const statusColor = (): string => {
        switch (data.status) {
            case 'Winner':
                return '#FFD700';
            case 'DNF':
            case 'DNS':
            case 'DSQ':
                return '#E10600';
            default:
                return '#666';
        }
    };

    const formatTimeDisplay = (): string => {
        if (data.position === 1) {
            return data.totalTime || '-';
        }
        return data.gapToLeader || data.totalTime || '-';
    };

    return (
        <TouchableOpacity
            style={[styles.resultCard, data.position === 1 && styles.winnerCard, style]}
            activeOpacity={0.8}
            onPress={handlePress}
        >
            <View style={styles.rowHeader}>
                <View style={styles.positionBadge}>
                    <Text style={styles.positionText}>{formatPosition()}</Text>
                    {data.gridPosition != null && (
                        <Text style={styles.gridText}>Grid P{data.gridPosition}</Text>
                    )}
                </View>

                <View style={styles.driverCell}>
                    <View
                        style={[
                            styles.driverNumber,
                            { backgroundColor: data.teamColor ? `#${data.teamColor}` : '#15151E' },
                        ]}
                    >
                        <Text style={styles.driverNumberText}>{data.driverNumber}</Text>
                    </View>
                    <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>{data.driverName}</Text>
                        <Text style={styles.teamName}>{data.teamName}</Text>
                    </View>
                </View>

                <View style={styles.timeCell}>
                    <Text style={styles.timeLabel}>
                        {data.position === 1 ? 'Total Time' : 'Gap'}
                    </Text>
                    <Text style={styles.timeValue}>{formatTimeDisplay()}</Text>
                </View>
            </View>

            <View style={styles.metaRow}>
                <Text style={styles.metaText}>Laps: {data.laps}</Text>
                <Text style={styles.metaText}>Pit Stops: {data.pitStops ?? '-'}</Text>
                <Text style={[styles.metaText, { color: statusColor() }]}>{data.status}</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    resultCard: {
        marginBottom: 12,
        padding: 14,
        backgroundColor: '#F9F9F9',
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#15151E',
    },
    winnerCard: {
        borderLeftColor: '#FFD700',
        backgroundColor: '#FFF9E6',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    positionBadge: {
        width: 70,
    },
    positionText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
    },
    gridText: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    driverCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    driverNumber: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    driverNumberText: {
        color: '#000',
        fontWeight: 'bold',
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
    },
    teamName: {
        fontSize: 12,
        color: '#666',
    },
    timeCell: {
        width: 110,
        alignItems: 'flex-end',
    },
    timeLabel: {
        fontSize: 11,
        color: '#666',
    },
    timeValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E10600',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    metaText: {
        fontSize: 12,
        color: '#666',
    },
});

export default React.memo(RaceResultCard);
