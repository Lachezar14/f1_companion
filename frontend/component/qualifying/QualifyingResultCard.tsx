import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QualifyingDriverClassification } from '../../../backend/types';

type QualifyingResultRowProps = {
    data: QualifyingDriverClassification;
    onPress?: (driverNumber: number) => void;
    showDivider?: boolean;
};

type QualifyingResultsSectionProps = {
    rows: QualifyingDriverClassification[];
    onDriverPress?: (driverNumber: number) => void;
    title?: string;
    emptyMessage?: string;
};

const QualifyingResultRow: React.FC<QualifyingResultRowProps> = ({
    data,
    onPress,
    showDivider = false,
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

    const sessionSegments = [
        { label: 'Q1', value: data.q1 },
        { label: 'Q2', value: data.q2 },
        { label: 'Q3', value: data.q3 },
    ];

    return (
        <TouchableOpacity
            style={[styles.rowContainer, showDivider && styles.rowDivider]}
            activeOpacity={0.85}
        >
            <View style={styles.rowHeader}>
                <View style={styles.positionBadge}>
                    <Text style={styles.positionText}>{formatPosition()}</Text>
                </View>
                {data.gapToPole && (
                    <View style={styles.gapChip}>
                        <Ionicons name="trending-up-outline" size={12} color="#E10600" />
                        <Text style={styles.gapChipText}>{data.gapToPole}</Text>
                    </View>
                )}
                {data.status && !data.position && (
                    <View style={styles.statusChip}>
                        <Text style={styles.statusChipText}>{data.status}</Text>
                    </View>
                )}
            </View>

            <View style={styles.driverRow}>
                <View
                    style={[
                        styles.numberPill,
                        { backgroundColor: data.teamColor ? `#${data.teamColor}` : '#15151E' },
                    ]}
                >
                    <Text style={styles.numberPillText}>{data.driverNumber}</Text>
                </View>
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{data.shortName}</Text>
                    <Text style={styles.teamName}>{data.teamName}</Text>
                </View>
                <View style={styles.bestBlock}>
                    <Ionicons name="time-outline" size={18} color="#E10600" />
                    <View style={styles.bestTextGroup}>
                        <Text style={styles.bestLabel}>Best</Text>
                        <Text style={styles.bestValue}>{data.best || '-'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.segmentsRow}>
                {sessionSegments.map(segment => (
                    <View key={segment.label} style={styles.segmentCard}>
                        <Text style={styles.segmentLabel}>{segment.label}</Text>
                        <Text style={styles.segmentValue}>{segment.value || '-'}</Text>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
};

const QualifyingResultsSection: React.FC<QualifyingResultsSectionProps> = ({
    rows,
    onDriverPress,
    title = 'Qualifying Classification',
    emptyMessage = 'No classification available',
}) => {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {rows.length === 0 ? (
                <Text style={styles.noData}>{emptyMessage}</Text>
            ) : (
                rows.map((row, index) => (
                    <QualifyingResultRow
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
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    noData: {
        textAlign: 'center',
        color: '#999',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
    rowContainer: {
        paddingVertical: 16,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#C8CEDA',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    positionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F3F4F9',
    },
    positionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#15151E',
    },
    gapChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(225,6,0,0.08)',
        marginLeft: 8,
        gap: 4,
    },
    gapChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#B40012',
    },
    statusChip: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#ECEFF6',
    },
    statusChipText: {
        fontSize: 11,
        letterSpacing: 0.5,
        fontWeight: '700',
        color: '#596074',
        textTransform: 'uppercase',
    },
    driverRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    numberPill: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    numberPillText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#15151E',
    },
    teamName: {
        fontSize: 12,
        color: '#7A7F92',
        marginTop: 2,
    },
    bestBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bestLabel: {
        fontSize: 11,
        color: '#8B8B8B',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    bestValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E10600',
    },
    segmentsRow: {
        flexDirection: 'row',
        marginTop: 14,
        gap: 10,
    },
    segmentCard: {
        flex: 1,
        backgroundColor: '#F3F4F9',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E4E7F0',
    },
    segmentLabel: {
        fontSize: 11,
        color: '#8B8B8B',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    segmentValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
        marginTop: 4,
    },
    bestTextGroup: {
        alignItems: 'flex-end',
    },
});

export default React.memo(QualifyingResultsSection);
