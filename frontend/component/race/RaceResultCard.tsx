import React from 'react';
import { colors, radius, semanticColors, spacing, typography } from '../../theme/tokens';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { RaceDriverClassification } from '../../../backend/types';
import { deriveDriverCode } from '../../../utils/driver';
import DriverNumberBadge from '../common/DriverNumberBadge';

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
                <DriverNumberBadge
                    driverNumber={data.driverNumber}
                    teamColor={data.teamColor}
                    style={styles.numberBadge}
                />
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
    sectionTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.sm,
    },
    noData: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        textAlign: 'center',
        paddingVertical: spacing.lg,
        fontStyle: 'italic',
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#C7CBD8',
    },
    positionColumn: {
        width: 56,
    },
    positionText: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    gridText: {
        marginTop: 2,
        fontSize: typography.size.xs,
        color: '#7B7B7B',
    },
    driverColumn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    numberBadge: {
        marginRight: spacing.sm,
    },
    driverInfo: {
        flex: 1,
    },
    driverCode: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    teamName: {
        fontSize: typography.size.sm,
        color: '#7A7A7A',
    },
    valueColumn: {
        width: 110,
        alignItems: 'flex-end',
    },
    valueLabel: {
        fontSize: typography.size.xs,
        color: '#8B8B8B',
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    valueText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginTop: 2,
    },
});

export default React.memo(RaceResultsSection);
