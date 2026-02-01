import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRaceSessionDetail } from '../../../../backend/service/openf1Service';
import type { RaceSessionDetail } from '../../../../backend/types';
import RaceResultCard from '../../../component/session/RaceResultCard';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

const EMPTY_SAFETY_CAR_LAPS: number[] = [];

const RaceScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadRaceData = useCallback(async (): Promise<RaceSessionDetail> => {
        return getRaceSessionDetail(sessionKey);
    }, [sessionKey]);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<RaceSessionDetail>(loadRaceData, [loadRaceData]);

    const rows = data?.classification ?? [];
    const safetyCarLaps = data?.raceControlSummary.safetyCarLaps ?? EMPTY_SAFETY_CAR_LAPS;
    const driverEntries = data?.drivers ?? [];

    const handleDriverPress = useCallback(
        (driverNumber: number) => {
            const driverData =
                driverEntries.find(entry => entry.driverNumber === driverNumber) ?? null;
            navigation.navigate('DriverOverview', {
                driverNumber,
                sessionKey,
                safetyCarLaps,
                driverData,
            });
        },
        [navigation, sessionKey, safetyCarLaps, driverEntries]
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading race data...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const session = data;
    const heroDate =
        session &&
        new Date(session.date_start).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });

    const heroStats = [
        { label: 'Drivers', value: driverEntries.length || '–' },
        { label: 'SC Laps', value: safetyCarLaps.length || '0' },
        { label: 'Laps', value: rows[0]?.laps ?? '–' },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <Text style={styles.heroSubtitle}>{meetingName || session?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {heroDate && <Text style={styles.heroDate}>{heroDate}</Text>}
                    <View style={styles.chipRow}>
                        {session?.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{session.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        {session?.country_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{session.country_name}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                <View style={styles.heroStats}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Race Classification</Text>
                {rows.length === 0 ? (
                    <Text style={styles.noData}>No classification available</Text>
                ) : (
                    rows.map(row => (
                        <RaceResultCard
                            key={row.driverNumber}
                            data={row}
                            onPress={handleDriverPress}
                        />
                    ))
                )}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default RaceScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2F2F2',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#E10600',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    heroCard: {
        backgroundColor: '#1C1C27',
        margin: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroContent: {
        marginBottom: 16,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 4,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.75)',
        marginTop: 6,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        paddingVertical: 12,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 4,
    },
    section: {
        margin: 16,
        backgroundColor: '#FFF',
        padding: 16,
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
        textAlign: 'center',
        color: '#999',
    },
    refreshHint: {
        paddingVertical: 24,
        textAlign: 'center',
        color: '#AAA',
    },
});
