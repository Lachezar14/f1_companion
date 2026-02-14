import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SessionDriverData } from '../../../backend/types';
import { colors, radius, semanticColors, spacing, typography } from '../../theme/tokens';
import {
    deriveDriverCode,
    formatDriverPosition,
    getDriverPositionColor,
} from '../../../utils/driver';
import DriverNumberBadge from '../common/DriverNumberBadge';

export interface DriverSessionData {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    lapCount: number;
    fastestLap: string | null;
    dnf: boolean;
    dns: boolean;
    dsq: boolean;
    teamColor?: string;
    driverEntry?: SessionDriverData | null;
}

export type DriverOption = {
    driverNumber: number;
    name: string;
    team: string;
    teamColor?: string | null;
};

interface DriverCardProps {
    driver: DriverSessionData;
    sessionKey: number;
    isFirst?: boolean;
    showDivider?: boolean;
    driverOptions?: DriverOption[];
}

interface FreePracticeResultsSectionProps {
    drivers: DriverSessionData[];
    sessionKey: number;
    title?: string;
    emptyMessage?: string;
    driverOptions?: DriverOption[];
}

type NavigationProp = NativeStackNavigationProp<any>;

const DriverRow = ({
    driver,
    sessionKey,
    driverOptions,
    isFirst = false,
    showDivider = false,
}: DriverCardProps) => {
    const navigation = useNavigation<NavigationProp>();

    const getDriverCode = (): string => {
        const shortCode = driver.driverEntry?.driver.shortName?.trim();
        if (shortCode) return shortCode.toUpperCase();
        return deriveDriverCode(driver.driverName);
    };

    const handlePress = () => {
        navigation.navigate('DriverPracticeOverview', {
            driverNumber: driver.driverNumber,
            sessionKey: sessionKey,
            driverData: driver.driverEntry ?? undefined,
            driverOptions,
        });
    };

    return (
        <TouchableOpacity
            style={[styles.rowContainer, showDivider && styles.rowDivider]}
            onPress={handlePress}
            activeOpacity={0.82}
        >
            <View style={styles.positionColumn}>
                <Text
                    style={[
                        styles.positionText,
                        {
                            color: getDriverPositionColor({
                                position: driver.position,
                                dnf: driver.dnf,
                                dns: driver.dns,
                                dsq: driver.dsq,
                            }),
                        },
                    ]}
                >
                    {formatDriverPosition({
                        position: driver.position,
                        dnf: driver.dnf,
                        dns: driver.dns,
                        dsq: driver.dsq,
                    })}
                </Text>
            </View>

            <View style={styles.driverColumn}>
                <DriverNumberBadge
                    driverNumber={driver.driverNumber}
                    teamColor={driver.teamColor}
                    style={styles.numberBadge}
                />
                <View style={styles.driverInfo}>
                    <Text style={styles.driverCode}>{getDriverCode()}</Text>
                    <Text style={styles.teamName} numberOfLines={1}>
                        {driver.teamName}
                    </Text>
                </View>
            </View>

            <View style={styles.lapColumn}>
                <Text style={styles.positionText}>
                    {driver.lapCount}
                </Text>
            </View>

            <View style={styles.valueColumn}>
                <Text style={styles.valueLabel}>Best</Text>
                <Text style={styles.valueText}>{driver.fastestLap || '—'}</Text>
            </View>
        </TouchableOpacity>
    );
};

export default function FreePracticeResultsSection({
    drivers,
    sessionKey,
    title = 'Session Results',
    emptyMessage = 'No session data available',
    driverOptions,
}: FreePracticeResultsSectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>

            {drivers.length > 0 ? (
                <>
                    <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderPos}>Pos</Text>
                        <Text style={styles.tableHeaderDriver}>Driver</Text>
                        <Text style={styles.tableHeaderLaps}>Laps</Text>
                        <Text style={styles.tableHeaderTime}>Best Time</Text>
                    </View>
                    {drivers.map((driver, index) => (
                        <DriverRow
                            key={driver.driverNumber}
                            driver={driver}
                            sessionKey={sessionKey}
                            isFirst={driver.position === 1}
                            showDivider={index < drivers.length - 1}
                            driverOptions={driverOptions}
                        />
                    ))}
                </>
            ) : (
                <Text style={styles.noData}>{emptyMessage}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        backgroundColor: semanticColors.surface,
        padding: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
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
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: '#F8F8F8',
        borderRadius: radius.sm,
        marginBottom: spacing.xs,
    },
    tableHeaderPos: {
        width: 50,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
    },
    tableHeaderDriver: {
        flex: 1,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
    },
    tableHeaderLaps: {
        width: 50,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textAlign: 'center',
    },
    tableHeaderTime: {
        width: 80,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textAlign: 'right',
    },
    noData: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: spacing.sm,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#D2D6E2',
    },
    positionColumn: {
        width: 52,
    },
    lapColumn: {
    },
    positionText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
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
        color: semanticColors.textMuted,
    },
    valueColumn: {
        alignItems: 'flex-end',
        width: 100,
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
