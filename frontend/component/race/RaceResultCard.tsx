import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { RaceDriverClassification } from '../../../backend/types';
import { deriveDriverCode } from '../../../utils/driver';

type RaceResultRowProps = {
    data: RaceDriverClassification;
    onPress?: (driverNumber: number) => void;
    showDivider?: boolean;
};

type RaceResultsSectionProps = {
    rows: RaceDriverClassification[];
    onDriverPress?: (driverNumber: number) => void;
    title?: string;
    emptyMessage?: string;
};

const RaceResultRow: React.FC<RaceResultRowProps> = ({ data, onPress, showDivider = false }) => {
    const handlePress = () => {
        if (onPress) {
            onPress(data.driverNumber);
        }
    };

    const getDriverCode = (): string => deriveDriverCode(data.driverName);

    const positionDisplay = (): string => {
        const status = data.status?.toUpperCase();
        if (status === 'DNF' || status === 'DNS' || status === 'DSQ') {
            return status;
        }
        if (typeof data.position === 'number' && data.position > 0) {
            return `P${data.position}`;
        }
        return status || '-';
    };

    const formatTimeDisplay = (): string => {
        if (data.position === 1) {
            return data.totalTime || '-';
        }
        return data.gapToLeader || data.totalTime || '-';
    };

    return (
        <TouchableOpacity
            style={[styles.rowContainer, showDivider && styles.rowDivider]}
            activeOpacity={0.82}
            onPress={handlePress}
        >
            <View style={styles.positionColumn}>
                <Text style={styles.positionText}>{positionDisplay()}</Text>
                {data.gridPosition != null && (
                    <Text style={styles.gridText}>Grid {data.gridPosition}</Text>
                )}
            </View>

            <View style={styles.driverColumn}>
                <View
                    style={[
                        styles.driverBubble,
                        { backgroundColor: data.teamColor ? `#${data.teamColor}` : '#15151E' },
                    ]}
                >
                    <Text style={styles.driverBubbleText}>{data.driverNumber}</Text>
                </View>
                <View style={styles.driverInfo}>
                    <Text style={styles.driverCode}>{getDriverCode()}</Text>
                    <Text style={styles.teamName} numberOfLines={1}>
                        {data.teamName}
                    </Text>
                </View>
            </View>

            <View style={styles.valueColumn}>
                <Text style={styles.valueLabel}>{data.position === 1 ? 'Total' : 'Gap'}</Text>
                <Text style={styles.valueText}>{formatTimeDisplay()}</Text>
            </View>
        </TouchableOpacity>
    );
};

const RaceResultsSection: React.FC<RaceResultsSectionProps> = ({
    rows,
    onDriverPress,
    title = 'Race Classification',
    emptyMessage = 'No classification available',
}) => {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {rows.length === 0 ? (
                <Text style={styles.noData}>{emptyMessage}</Text>
            ) : (
                rows.map((row, index) => (
                    <RaceResultRow
                        key={row.driverNumber}
                        data={row}
                        onPress={onDriverPress}
                        showDivider={index < rows.length - 1}
                    />
                ))
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        margin: 16,
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 4,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E3E3',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
        marginBottom: 12,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#C7CBD8',
    },
    positionColumn: {
        width: 56,
    },
    positionText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    gridText: {
        marginTop: 2,
        fontSize: 11,
        color: '#7B7B7B',
    },
    driverColumn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    driverBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    driverBubbleText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13,
    },
    driverInfo: {
        flex: 1,
    },
    driverCode: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
    },
    teamName: {
        fontSize: 13,
        color: '#7A7A7A',
    },
    valueColumn: {
        width: 110,
        alignItems: 'flex-end',
    },
    valueLabel: {
        fontSize: 11,
        color: '#8B8B8B',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    valueText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#E10600',
        marginTop: 2,
    },
});

export default React.memo(RaceResultsSection);
