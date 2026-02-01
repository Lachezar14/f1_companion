import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import type { QualifyingDriverClassification } from '../../../backend/types';

export type QualifyingResultCardProps = {
    data: QualifyingDriverClassification;
    onPress?: (driverNumber: number) => void;
    style?: ViewStyle;
};

const QualifyingResultCard: React.FC<QualifyingResultCardProps> = ({
    data,
    onPress,
    style,
}) => {

    /*const handlePress = () => {
        if (onPress) {
            onPress(data.driverNumber);
        }
    };*/

    const formatPosition = (): string => {
        if (data.status) return data.status;
        return data.position ? `P${data.position}` : '-';
    };

    const renderSegment = (label: string, value: string | null) => (
        <View key={label} style={styles.segment}>
            <Text style={styles.segmentLabel}>{label}</Text>
            <Text style={styles.segmentValue}>{value || '-'}</Text>
        </View>
    );

    return (
        <TouchableOpacity
            style={[styles.driverRow, style]}
            activeOpacity={0.75}
        >
            <View style={styles.rowHeader}>
                <View style={styles.positionCell}>
                    <Text style={styles.positionText}>{formatPosition()}</Text>
                    {data.gapToPole && (
                        <Text style={styles.gapText}>{data.gapToPole}</Text>
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

            <View style={styles.bestCell}>
                <Text style={styles.bestLabel}>Best</Text>
                <Text style={styles.bestValue}>{data.best || '-'}</Text>
            </View>
            </View>

            <View style={styles.segmentsRow}>
                {renderSegment('Q1', data.q1)}
                {renderSegment('Q2', data.q2)}
                {renderSegment('Q3', data.q3)}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    driverRow: {
        marginBottom: 10,
        padding: 12,
        backgroundColor: '#F9F9F9',
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    positionCell: {
        width: 70,
    },
    positionText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
    },
    gapText: {
        fontSize: 12,
        color: '#888',
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
    bestCell: {
        width: 90,
        alignItems: 'flex-end',
    },
    bestLabel: {
        fontSize: 11,
        color: '#666',
    },
    bestValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E10600',
    },
    segmentsRow: {
        flexDirection: 'row',
        marginTop: 10,
    },
    segment: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 8,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    segmentLabel: {
        fontSize: 11,
        color: '#888',
    },
    segmentValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#15151E',
    },
});

export default React.memo(QualifyingResultCard);
