import React from 'react';
import { colors, radius, semanticColors, spacing, typography } from '../../theme/tokens';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QualifyingDriverClassification } from '../../../backend/types';
import DriverNumberBadge from '../common/DriverNumberBadge';

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
    const handlePress = () => {
        if (onPress) {
            onPress(data.driverNumber);
        }
    };

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
            onPress={handlePress}
            disabled={!onPress}
        >
            <View style={styles.rowHeader}>
                <View style={styles.positionBadge}>
                    <Text style={styles.positionText}>{formatPosition()}</Text>
                </View>
                {data.gapToPole && (
                    <View style={styles.gapChip}>
                        <Ionicons name="trending-up-outline" size={12} color={semanticColors.danger} />
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
                <DriverNumberBadge
                    driverNumber={data.driverNumber}
                    teamColor={data.teamColor}
                    style={styles.numberBadge}
                />
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{data.shortName}</Text>
                    <Text style={styles.teamName}>{data.teamName}</Text>
                </View>
                <View style={styles.bestBlock}>
                    <Ionicons name="time-outline" size={18} color={semanticColors.danger} />
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
        margin: spacing.md,
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxs,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    sectionHeader: {
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    noData: {
        textAlign: 'center',
        color: semanticColors.textMuted,
        paddingVertical: spacing.lg,
        fontStyle: 'italic',
    },
    rowContainer: {
        paddingVertical: spacing.md,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#C8CEDA',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    positionBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: '#F3F4F9',
    },
    positionText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    gapChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(225,6,0,0.08)',
        marginLeft: spacing.xs,
        gap: spacing.xxs,
    },
    gapChipText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: semanticColors.dangerStrong,
    },
    statusChip: {
        marginLeft: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        backgroundColor: '#ECEFF6',
    },
    statusChipText: {
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wide,
        fontWeight: typography.weight.bold,
        color: '#596074',
        textTransform: 'uppercase',
    },
    driverRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    numberBadge: {
        marginRight: spacing.sm,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    teamName: {
        fontSize: typography.size.sm,
        color: '#7A7F92',
        marginTop: 2,
    },
    bestBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    bestLabel: {
        fontSize: typography.size.xs,
        color: '#8B8B8B',
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    bestValue: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
    },
    segmentsRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    segmentCard: {
        flex: 1,
        backgroundColor: '#F3F4F9',
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E4E7F0',
    },
    segmentLabel: {
        fontSize: typography.size.xs,
        color: '#8B8B8B',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    segmentValue: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginTop: spacing.xxs,
    },
    bestTextGroup: {
        alignItems: 'flex-end',
    },
});

export default React.memo(QualifyingResultsSection);
