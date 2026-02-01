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
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function FreePracticeResultCard({ driver, sessionKey, isFirst = false }: DriverCardProps) {
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
            style={[styles.card, isFirst && styles.cardLeader]}
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

            <View style={styles.valueColumn}>
                <Text style={styles.valueLabel}>Best</Text>
                <Text style={styles.valueText}>{driver.fastestLap || '—'}</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E7E7E7',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    cardLeader: {
        borderLeftWidth: 3,
        borderLeftColor: '#FFD700',
    },
    positionColumn: {
        width: 52,
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
