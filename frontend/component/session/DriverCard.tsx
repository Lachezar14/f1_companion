import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DriverSessionData {
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
}

interface DriverCardProps {
    driver: DriverSessionData;
    sessionKey: number;
    isFirst?: boolean;
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function DriverCard({ driver, sessionKey, isFirst = false }: DriverCardProps) {
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

    const getLastName = (fullName: string): string => {
        const parts = fullName.split(' ');
        return parts[parts.length - 1];
    };

    const getTeamColor = (): string => {
        return driver.teamColor ? `#${driver.teamColor}` : '#15151E';
    };

    const handlePress = () => {
        navigation.navigate('DriverOverview', {
            driverNumber: driver.driverNumber,
            sessionKey: sessionKey,
        });
    };

    return (
        <TouchableOpacity
            style={[
                styles.driverRow,
                isFirst && styles.driverRowFirst,
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={styles.positionCell}>
                <Text
                    style={[
                        styles.positionText,
                        { color: getPositionColor(driver) },
                    ]}
                >
                    {formatPosition(driver)}
                </Text>
            </View>

            <View style={styles.driverCell}>
                <View style={[
                    styles.driverNumber,
                    { backgroundColor: getTeamColor() }
                ]}>
                    <Text style={styles.driverNumberText}>
                        {driver.driverNumber}
                    </Text>
                </View>
                <View style={styles.driverInfo}>
                    <Text
                        style={styles.driverName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {getLastName(driver.driverName)}
                    </Text>
                    <Text
                        style={styles.teamName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {driver.teamName}
                    </Text>
                </View>
            </View>

            <View style={styles.lapsCell}>
                <Text style={styles.lapsText}>{driver.lapCount}</Text>
            </View>

            <View style={styles.timeCell}>
                <Text style={styles.timeText}>
                    {driver.fastestLap || '-'}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        padding: 12,
        borderRadius: 8,
        marginBottom: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#E0E0E0',
    },
    driverRowFirst: {
        backgroundColor: '#FFF9E6',
        borderLeftColor: '#FFD700',
    },
    positionCell: {
        width: 50,
        alignItems: 'flex-start',
    },
    positionText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    driverCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#15151E',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    driverNumberText: {
        color: '#000000',
        fontWeight: "bold",
        fontSize: 14,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 2,
    },
    teamName: {
        fontSize: 12,
        color: '#666',
    },
    lapsCell: {
        width: 50,
        alignItems: 'center',
    },
    lapsText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    timeCell: {
        width: 80,
        alignItems: 'flex-end',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E10600',
    },
});