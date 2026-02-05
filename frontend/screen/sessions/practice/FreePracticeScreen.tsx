import React, { useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getPracticeSessionDetail } from '../../../../backend/service/openf1Service';
import FreePracticeResultsSection, { DriverSessionData } from "../../../component/practice/FreePracticeResultCard";
import { formatLapTime } from '../../../../shared/time';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import type { PracticeSessionDetail } from '../../../../backend/types';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadSessionDrivers = useCallback(
        () => getPracticeSessionDetail(sessionKey),
        [sessionKey]
    );

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<PracticeSessionDetail>(loadSessionDrivers, [loadSessionDrivers]);

    const driverEntries = data?.drivers ?? [];

    const drivers: DriverSessionData[] = driverEntries
        .map(entry => {
            const fastestLapSeconds = entry.laps
                .filter(lap => lap.lap_duration && lap.lap_duration > 0)
                .reduce<number | null>((best, lap) => {
                    if (lap.lap_duration == null) return best;
                    if (best == null || lap.lap_duration < best) {
                        return lap.lap_duration;
                    }
                    return best;
                }, null);

            return {
                position: entry.sessionResult?.position ?? null,
                driverNumber: entry.driver.number,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                lapCount: entry.laps.length,
                fastestLap: fastestLapSeconds ? formatLapTime(fastestLapSeconds) : null,
                dnf: entry.sessionResult?.dnf ?? false,
                dns: entry.sessionResult?.dns ?? false,
                dsq: entry.sessionResult?.dsq ?? false,
                teamColor: entry.driver.teamColor ?? undefined,
                driverEntry: entry,
            };
        })
        .sort((a, b) => {
            const posA = a.position ?? Number.MAX_SAFE_INTEGER;
            const posB = b.position ?? Number.MAX_SAFE_INTEGER;
            return posA - posB;
        });

    const bestLapSeconds = useMemo(() => {
        let best: number | null = null;
        driverEntries.forEach(entry => {
            entry.laps.forEach(lap => {
                if (!lap.lap_duration || lap.lap_duration <= 0) return;
                if (best === null || lap.lap_duration < best) {
                    best = lap.lap_duration;
                }
            });
        });
        return best;
    }, [driverEntries]);

    const bestLapLabel = bestLapSeconds ? formatLapTime(bestLapSeconds) : '—';

    const totalLaps = useMemo(
        () => driverEntries.reduce((total, entry) => total + entry.laps.length, 0),
        [driverEntries]
    );

    // Loading state
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading session details...</Text>
            </View>
        );
    }

    // Error state
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const sessionDetail = data;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            <View style={styles.heroCard}>
                <View>
                    <Text style={styles.heroSubtitle}>{meetingName || sessionDetail?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {sessionDetail?.date_start && (
                        <Text style={styles.heroDate}>
                            {new Date(sessionDetail.date_start).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </Text>
                    )}
                </View>
                <View style={styles.heroStats}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{drivers.length}</Text>
                        <Text style={styles.heroStatLabel}>Drivers</Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{bestLapLabel}</Text>
                        <Text style={styles.heroStatLabel}>Fastest Lap</Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{totalLaps}</Text>
                        <Text style={styles.heroStatLabel}>Total Laps</Text>
                    </View>
                </View>
            </View>

            <FreePracticeResultsSection drivers={drivers} sessionKey={sessionKey} />

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F2F2F2',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
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
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#E10600',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    heroCard: {
        backgroundColor: '#15151E',
        borderRadius: 24,
        padding: 20,
        margin: 16,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 24,
        color: '#FFF',
        fontWeight: '700',
        marginTop: 6,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
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
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 4,
    },
    heroDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    refreshHint: {
        fontSize: 12,
        color: '#CCC',
        textAlign: 'center',
        paddingVertical: 24,
    },
});
