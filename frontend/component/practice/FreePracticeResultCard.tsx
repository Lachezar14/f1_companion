import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SessionDriverData } from '../../../backend/types';

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

interface DriverCardProps {
    driver: DriverSessionData;
    sessionKey: number;
    isFirst?: boolean;
    showDivider?: boolean;
}

interface FreePracticeResultsSectionProps {
    drivers: DriverSessionData[];
    sessionKey: number;
    title?: string;
    emptyMessage?: string;
}

type NavigationProp = NativeStackNavigationProp<any>;

const DriverRow = ({ driver, sessionKey, isFirst = false, showDivider = false }: DriverCardProps) => {
    const navigation = useNavigation<NavigationProp>();

    const formatPosition = (driver: DriverSessionData): string => {
        if (driver.dns) return 'DNS';
        if (driver.dnf) return 'DNF';
        if (driver.dsq) return 'DSQ';
        if (driver.position) return `P${driver.position}`;
        return '-';
    };

    const getPositionColor = (driver: DriverSessionData): string => {
        if (driver.dns || driver.dnf || driver.dsq) return '#999';
        if (driver.position === 1) return '#FFD700';
        if (driver.position === 2) return '#C0C0C0';
        if (driver.position === 3) return '#CD7F32';
        return '#15151E';
    };

    const deriveCodeFromName = (fullName: string): string => {
        const parts = fullName.trim().split(' ');
        const target = (parts[parts.length - 1] || fullName).replace(/[^A-Za-z]/g, '');
        const upper = target.toUpperCase();
        if (upper.length >= 3) return upper.slice(0, 3);
        if (upper.length === 0 && fullName) {
            return fullName.slice(0, 3).toUpperCase();
        }
        const lastChar = upper.charAt(upper.length - 1) || fullName.charAt(0).toUpperCase() || 'X';
        return upper.padEnd(3, lastChar);
    };

    const getDriverCode = (): string => {
        const shortCode = driver.driverEntry?.driver.shortName?.trim();
        if (shortCode) return shortCode.toUpperCase();
        return deriveCodeFromName(driver.driverName);
    };

    const getTeamColor = (): string => {
        return driver.teamColor ? `#${driver.teamColor}` : '#15151E';
    };

    const handlePress = () => {
        navigation.navigate('DriverPracticeOverview', {
            driverNumber: driver.driverNumber,
            sessionKey: sessionKey,
            driverData: driver.driverEntry ?? undefined,
        });
    };

    return (
        <TouchableOpacity
            style={[styles.rowContainer, showDivider && styles.rowDivider]}
            onPress={handlePress}
            activeOpacity={0.82}
        >
            <View style={styles.positionColumn}>
                <Text style={[styles.positionText, { color: getPositionColor(driver) }]}>
                    {formatPosition(driver)}
                </Text>
            </View>

            <View style={styles.driverColumn}>
                <View style={[styles.driverBubble, { backgroundColor: getTeamColor() }]}>
                    <Text style={styles.driverBubbleText}>{driver.driverNumber}</Text>
                </View>
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
        backgroundColor: '#FFF',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
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
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 12,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        marginBottom: 8,
    },
    tableHeaderPos: {
        width: 50,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    tableHeaderDriver: {
        flex: 1,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    tableHeaderLaps: {
        width: 50,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'center',
    },
    tableHeaderTime: {
        width: 80,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'right',
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
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
        fontSize: 15,
        fontWeight: '700',
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
        color: '#777',
    },
    valueColumn: {
        alignItems: 'flex-end',
        width: 100,
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
