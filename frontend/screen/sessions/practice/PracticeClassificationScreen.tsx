import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getPracticeSessionDetail } from '../../../../backend/service/openf1Service';
import type { PracticeSessionDetail } from '../../../../backend/types';
import FreePracticeResultsSection, {
    DriverOption,
    DriverSessionData,
} from '../../../component/practice/FreePracticeResultCard';
import { formatLapTime } from '../../../../shared/time';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

const PracticeClassificationScreen = () => {
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
        refresh,
        refreshing,
    } = useServiceRequest<PracticeSessionDetail>(loadSessionDrivers, [loadSessionDrivers]);

    const driverEntries = data?.drivers ?? [];

    const drivers = useMemo<DriverSessionData[]>(() => {
        return driverEntries
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
    }, [driverEntries]);

    const driverOptions = useMemo<DriverOption[]>(
        () =>
            drivers.map(driver => ({
                driverNumber: driver.driverNumber,
                name: driver.driverName,
                team: driver.teamName,
                teamColor: driver.teamColor,
            })),
        [drivers]
    );

    const heroDate =
        data?.date_start
            ? new Date(data.date_start).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
              })
            : null;

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.message}>Loading classification...</Text>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.message}>{error || 'No practice detail found'}</Text>
                <Text style={styles.hint}>Pull to refresh or try again.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            <View style={styles.header}>
                <Text style={styles.overline}>{meetingName || data.location}</Text>
                <Text style={styles.title}>{sessionName}</Text>
                <Text style={styles.subtitle}>
                    Practice classification • {drivers.length}{' '}
                    {drivers.length === 1 ? 'driver' : 'drivers'}
                </Text>
                {heroDate ? <Text style={styles.date}>{heroDate}</Text> : null}
            </View>
            <FreePracticeResultsSection
                drivers={drivers}
                sessionKey={sessionKey}
                title="Classification"
                emptyMessage="No classification data"
                driverOptions={driverOptions}
            />
            <Text style={styles.footerHint}>Pull down to refresh classification</Text>
        </ScrollView>
    );
};

export default PracticeClassificationScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F6F8',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    overline: {
        fontSize: 12,
        color: '#7C7F93',
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    title: {
        marginTop: 4,
        fontSize: 24,
        fontWeight: '700',
        color: '#15151E',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#7C7F93',
    },
    date: {
        marginTop: 2,
        fontSize: 13,
        color: '#9699AF',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E10600',
        marginBottom: 6,
    },
    message: {
        fontSize: 14,
        color: '#5F6272',
        textAlign: 'center',
    },
    hint: {
        marginTop: 6,
        fontSize: 12,
        color: '#8A8FA6',
    },
    footerHint: {
        textAlign: 'center',
        paddingVertical: 18,
        color: '#9A9FB5',
        fontSize: 12,
    },
});
