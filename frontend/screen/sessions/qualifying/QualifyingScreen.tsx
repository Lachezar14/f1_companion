import React, { useCallback, useMemo } from 'react';
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
import { getQualifyingSessionDetail } from '../../../../backend/service/openf1Service';
import type { QualifyingSessionDetail } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

type SectorResult = {
    driverName: string;
    teamName: string;
    time: number;
};

const QualifyingScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadSession = useCallback(
        () => getQualifyingSessionDetail(sessionKey),
        [sessionKey]
    );

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<QualifyingSessionDetail>(loadSession, [loadSession]);

    const rows = data?.classification ?? [];
    const driverEntries = data?.drivers ?? [];

    const heroDate = data?.date_start
        ? new Date(data.date_start).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        })
        : null;

    const poleLap = rows[0]?.best ?? '—';
    const poleMargin = rows[1]?.gapToPole ?? '—';
    const q3Cutoff = rows.find(row => row.position === 10)?.q2 ?? null;
    const q2Cutoff = rows.find(row => row.position === 15)?.q1 ?? null;

    const heroStats = [
        { label: 'Drivers', value: rows.length || '–' },
        { label: 'Pole Lap', value: poleLap },
        { label: 'Pole Margin', value: poleMargin },
    ];

    const insightsMetrics = [
        { label: 'Q3 Cutoff', value: q3Cutoff ?? '—' },
        { label: 'Q2 Cutoff', value: q2Cutoff ?? '—' }
    ];

    const poleResult = rows[0] ?? null;
    const poleGap = rows[1]?.gapToPole ?? '—';

    const fastestSectors = useMemo<Record<'s1' | 's2' | 's3', SectorResult | null>>(() => {
        const initial: Record<'s1' | 's2' | 's3', SectorResult | null> = {
            s1: null,
            s2: null,
            s3: null,
        };

        driverEntries.forEach(entry => {
            entry.laps.forEach(lap => {
                const sectors: Array<{ key: 's1' | 's2' | 's3'; value: number | null | undefined }> = [
                    { key: 's1', value: lap.duration_sector_1 },
                    { key: 's2', value: lap.duration_sector_2 },
                    { key: 's3', value: lap.duration_sector_3 },
                ];
                sectors.forEach(({ key, value }) => {
                    if (typeof value !== 'number' || value <= 0) {
                        return;
                    }
                    const current = initial[key];
                    if (!current || value < current.time) {
                        initial[key] = {
                            driverName: entry.driver.name,
                            teamName: entry.driver.team,
                            time: value,
                        };
                    }
                });
            });
        });

        return initial;
    }, [driverEntries]);

    const sectorRows = [
        { label: 'Sector 1', stat: fastestSectors.s1 },
        { label: 'Sector 2', stat: fastestSectors.s2 },
        { label: 'Sector 3', stat: fastestSectors.s3 },
    ];

    const formatSectorTime = (value?: number) =>
        typeof value === 'number' && value > 0 ? `${value.toFixed(3)}s` : '—';

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('QualifyingClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading qualifying data...</Text>
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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor="#E10600"
                />
            }
        >
            <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                    <Text style={styles.heroSubtitle}>{meetingName || data?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {heroDate ? <Text style={styles.heroDate}>{heroDate}</Text> : null}
                    <View style={styles.chipRow}>
                        {data?.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{data.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        <View style={styles.chip}>
                            <Text style={styles.chipText}>{rows.length} Drivers</Text>
                        </View>
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

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    activeOpacity={0.9}
                    onPress={handleOpenClassification}
                >
                    <Text style={styles.actionButtonText}>View Classification</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {rows.length || 0} {rows.length === 1 ? 'driver' : 'drivers'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.snapshotCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Qualifying Snapshot</Text>
                    <Text style={styles.cardTitle}>Phase cut-offs & pole data</Text>
                </View>
                <View style={styles.metricRow}>
                    {insightsMetrics.map(metric => (
                        <View key={metric.label} style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metric.value}</Text>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {poleResult ? (
                <View style={styles.poleCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardOverline}>Pole Position</Text>
                        <Text style={styles.cardTitle}>Fastest driver in Q3</Text>
                    </View>
                    <Text style={styles.poleDriver}>{poleResult.driverName}</Text>
                    <Text style={styles.poleTeam}>{poleResult.teamName}</Text>
                    <View style={styles.poleMetaRow}>
                        <View style={styles.poleMetaItem}>
                            <Text style={styles.poleMetaLabel}>Pole Lap</Text>
                            <Text style={styles.poleMetaValue}>{poleResult.best ?? poleLap}</Text>
                        </View>
                        <View style={styles.poleMetaItem}>
                            <Text style={styles.poleMetaLabel}>Gap to P2</Text>
                            <Text style={styles.poleMetaValue}>{poleGap}</Text>
                        </View>
                    </View>
                </View>
            ) : null}

            <View style={styles.sectorCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Micro Sectors</Text>
                    <Text style={styles.cardTitle}>Fastest drivers per sector</Text>
                    <Text style={styles.cardSubtitle}>Based on clean laps across all sessions</Text>
                </View>
                {sectorRows.map(row => (
                    <View key={row.label} style={styles.sectorRow}>
                        <View style={styles.sectorLabelBlock}>
                            <Text style={styles.sectorLabel}>{row.label}</Text>
                            <Text style={styles.sectorDriver}>
                                {row.stat ? row.stat.driverName : 'No data'}
                            </Text>
                            <Text style={styles.sectorTeam}>
                                {row.stat ? row.stat.teamName : ''}
                            </Text>
                        </View>
                        <Text style={styles.sectorTime}>
                            {formatSectorTime(row.stat?.time)}
                        </Text>
                    </View>
                ))}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default QualifyingScreen;

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
        backgroundColor: '#141722',
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
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 6,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.72)',
        marginTop: 6,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
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
        fontSize: 18,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        letterSpacing: 0.7,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    actionRow: {
        marginHorizontal: 16,
        marginBottom: 8,
    },
    actionButton: {
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#15151E',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionButtonSubtitle: {
        marginTop: 6,
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    snapshotCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardOverline: {
        fontSize: 12,
        letterSpacing: 1,
        fontWeight: '700',
        color: '#7A7E92',
        textTransform: 'uppercase',
    },
    cardTitle: {
        marginTop: 4,
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    cardSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#7A7E92',
    },
    metricRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metricItem: {
        flex: 1,
        backgroundColor: '#F7F8FB',
        borderRadius: 16,
        padding: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E6F0',
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    metricLabel: {
        marginTop: 6,
        fontSize: 12,
        color: '#7A7E92',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    poleCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#F8F5FF',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    poleDriver: {
        fontSize: 22,
        fontWeight: '800',
        color: '#2A1F5D',
    },
    poleTeam: {
        fontSize: 15,
        color: '#6C5FA5',
        marginTop: 2,
    },
    poleMetaRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 14,
    },
    poleMetaItem: {
        flex: 1,
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
    },
    poleMetaLabel: {
        fontSize: 11,
        color: '#8A83B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
    },
    poleMetaValue: {
        marginTop: 6,
        fontSize: 18,
        fontWeight: '700',
        color: '#2A1F5D',
    },
    sectorCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    sectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ECEFF5',
    },
    sectorLabelBlock: {
        flex: 1,
    },
    sectorLabel: {
        fontSize: 13,
        color: '#9297B0',
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    sectorDriver: {
        marginTop: 4,
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2435',
    },
    sectorTeam: {
        fontSize: 13,
        color: '#7A819D',
    },
    sectorTime: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
        marginLeft: 12,
    },
    refreshHint: {
        paddingVertical: 24,
        textAlign: 'center',
        color: '#AAA',
    },
});
