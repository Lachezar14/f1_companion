import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getDriverSeasonStats } from '../../../backend/service/openf1Service';
import type { DriverSeasonSessionSummary, DriverSeasonStats } from '../../../backend/types';
import { DEFAULT_SEASON_YEAR } from '../../config/appConfig';
import { Ionicons } from '@expo/vector-icons';

type RouteParams = {
    driverNumber: number;
    year?: number;
    driverName?: string;
    teamName?: string;
    teamColor?: string;
    headshotUrl?: string;
};

interface DriverSeasonState {
    stats: DriverSeasonStats | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const DriverSeasonScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        year,
        driverName,
        teamName,
        teamColor,
        headshotUrl,
    } = route.params;
    const seasonYear = year ?? DEFAULT_SEASON_YEAR;

    const [state, setState] = useState<DriverSeasonState>({
        stats: null,
        loading: true,
        refreshing: false,
        error: null,
    });
    const [expandedSections, setExpandedSections] = useState({
        race: true,
        qualifying: true,
    });

    const driverContext = useMemo(
        () => ({
            name: driverName,
            team: teamName,
            teamColor,
            headshotUrl,
        }),
        [driverName, teamName, teamColor, headshotUrl]
    );

    const fetchStats = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const stats = await getDriverSeasonStats(driverNumber, seasonYear, driverContext);
                if (!stats) {
                    setState({
                        stats: null,
                        loading: false,
                        refreshing: false,
                        error: 'No stats available for this driver',
                    });
                    return;
                }

                setState({
                    stats,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    stats: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load stats',
                });
            }
        },
        [driverNumber, seasonYear, driverContext]
    );

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleRefresh = useCallback(() => fetchStats(true), [fetchStats]);

    const formatSessionDate = useCallback((iso: string | undefined) => {
        if (!iso) return 'Date TBC';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return 'Date TBC';
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, []);

    const renderSessionCard = (summary: DriverSeasonSessionSummary) => {
        const isRace = summary.sessionType === 'Race';
        const badgeStyle = isRace ? styles.raceBadge : styles.qualiBadge;
        const badgeTextStyle = isRace ? styles.raceBadgeText : styles.qualiBadgeText;

        const resultValue = summary.position ? `P${summary.position}` : summary.status ?? '-';

        const stats = [
            {
                label: 'Laps',
                value:
                    typeof summary.laps === 'number' ? summary.laps.toString() : summary.laps ?? '-',
            },
            { label: 'Time', value: summary.duration ?? '-' },
            {
                label: isRace ? 'Gap' : 'Gap to Pole',
                value: summary.gapToLeader ?? '-',
            },
        ];

        return (
            <View key={summary.sessionKey} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionHeaderText}>
                        <Text style={styles.sessionName}>{summary.sessionName}</Text>
                        <Text style={styles.sessionMeta}>
                            {summary.circuit} · {summary.countryName}
                        </Text>
                        <Text style={styles.sessionDate}>{formatSessionDate(summary.dateStart)}</Text>
                    </View>
                    <View style={[styles.sessionBadge, badgeStyle]}>
                        <Text style={[styles.sessionBadgeText, badgeTextStyle]}>
                            {summary.sessionType}
                        </Text>
                    </View>
                </View>

                <View style={styles.resultRow}>
                    <View style={[styles.resultChip, styles.resultChipSpacing]}>
                        <Text style={styles.resultLabel}>Result</Text>
                        <Text style={styles.resultValue}>{resultValue}</Text>
                    </View>
                    <View style={styles.resultChip}>
                        <Text style={styles.resultLabel}>Location</Text>
                        <Text style={styles.resultValue}>{summary.location || '—'}</Text>
                    </View>
                </View>

                <View style={styles.sessionStatsRow}>
                    {stats.map((stat, index) => (
                        <View
                            key={stat.label}
                            style={[
                                styles.sessionStat,
                                index < stats.length - 1 && styles.sessionStatSpacing,
                            ]}
                        >
                            <Text style={styles.sessionStatLabel}>{stat.label}</Text>
                            <Text style={styles.sessionStatValue}>{stat.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const toggleSection = (key: 'race' | 'qualifying') => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const renderSessionsSection = (
        title: string,
        data: DriverSeasonSessionSummary[],
        variant: 'Race' | 'Qualifying',
        keyName: 'race' | 'qualifying'
    ) => {
        const expanded = expandedSections[keyName];
        return (
            <View style={styles.section} key={title}>
                <TouchableOpacity
                    style={styles.sectionHeaderRow}
                    onPress={() => toggleSection(keyName)}
                    activeOpacity={0.82}
                >
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#6F6F6F"
                    />
                </TouchableOpacity>
                {expanded ? (
                    data.length ? (
                        data.map(renderSessionCard)
                    ) : (
                        <Text style={styles.emptySectionText}>
                            No {variant.toLowerCase()} sessions recorded.
                        </Text>
                    )
                ) : null}
            </View>
        );
    };

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading driver stats...</Text>
            </View>
        );
    }

    if (state.error || !state.stats) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    const { driver, season, totals, sessions } = state.stats;
    const teamColorHex = driver.teamColor ? `#${driver.teamColor}` : '#15151E';

    const heroStats = [
        { label: 'Wins', value: totals.wins },
        { label: 'Podiums', value: totals.podiums },
        { label: 'Race Starts', value: totals.races },
    ];

    const metricCards = [
        {
            label: 'Avg Race Pos',
            value: totals.averageRacePosition != null ? totals.averageRacePosition.toFixed(2) : '-',
        },
        {
            label: 'Avg Quali Pos',
            value:
                totals.averageQualifyingPosition != null
                    ? totals.averageQualifyingPosition.toFixed(2)
                    : '-',
        },
        {
            label: 'Best Race',
            value: totals.bestRaceResult != null ? `P${totals.bestRaceResult}` : '-',
        },
        {
            label: 'Best Quali',
            value: totals.bestQualifyingResult != null ? `P${totals.bestQualifyingResult}` : '-',
        },
        { label: 'Quali Sessions', value: totals.qualifyingSessions },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            <View style={[styles.heroCard, { backgroundColor: teamColorHex }]}>
                <View style={styles.heroHeader}>
                    <View
                        style={[
                            styles.numberBadge,
                            { backgroundColor: driver.teamColor ? `#${driver.teamColor}` : '#15151E' },
                        ]}
                    >
                        <Text style={styles.numberBadgeText}>#{driver.number}</Text>
                    </View>
                    <View style={styles.heroInfo}>
                        <Text style={styles.heroTitle}>{driver.name}</Text>
                        <Text style={styles.heroSubtitleText}>{driver.team}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>Season {season}</Text>
                            </View>
                        </View>
                    </View>
                    {driver.headshotUrl ? (
                        <Image source={{ uri: driver.headshotUrl }} style={styles.heroHeadshot} />
                    ) : (
                        <View style={styles.heroHeadshotPlaceholder}>
                            <Text style={styles.heroHeadshotInitial}>{driver.name[0]}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.heroStatRow}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.metricsSection}>
                {metricCards.map(card => (
                    <View key={card.label} style={styles.metricCard}>
                        <Text style={styles.metricLabel}>{card.label}</Text>
                        <Text style={styles.metricValue}>{card.value}</Text>
                    </View>
                ))}
            </View>

            {renderSessionsSection('Race Results', sessions.races, 'Race', 'race')}
            {renderSessionsSection('Qualifying Results', sessions.qualifying, 'Qualifying', 'qualifying')}
        </ScrollView>
    );
};

export default DriverSeasonScreen;

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
        color: '#666',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E10600',
    },
    errorMessage: {
        marginTop: 8,
        color: '#666',
        textAlign: 'center',
    },
    heroCard: {
        backgroundColor: '#15151E',
        margin: 16,
        borderRadius: 28,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    numberBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 12,
    },
    numberBadgeText: {
        color: '#FFF',
        fontWeight: '700',
        letterSpacing: 1,
    },
    heroInfo: {
        flex: 1,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFF',
    },
    heroSubtitleText: {
        color: 'rgba(255,255,255,0.75)',
        marginTop: 4,
    },
    heroChipRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    heroChip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    heroChipText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    heroHeadshot: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginLeft: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#1F1F2B',
    },
    heroHeadshotPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginLeft: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1F1F2B',
    },
    heroHeadshotInitial: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '700',
    },
    heroStatRow: {
        flexDirection: 'row',
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
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 4,
    },
    metricsSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    metricCard: {
        width: '48%',
        backgroundColor: '#FFF',
        borderRadius: 18,
        padding: 16,
        margin: '1%',
        borderWidth: 1,
        borderColor: '#E6E6E6',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    metricLabel: {
        fontSize: 12,
        color: '#8A8A8A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metricValue: {
        marginTop: 8,
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    section: {
        marginHorizontal: 16,
        marginBottom: 24,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#15151E',
        marginBottom: 0,
    },
    emptySectionText: {
        color: '#777',
        fontStyle: 'italic',
    },
    sessionCard: {
        backgroundColor: '#F9F9FB',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ECECEC',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    sessionHeaderText: {
        flex: 1,
        paddingRight: 12,
    },
    sessionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#15151E',
    },
    sessionMeta: {
        marginTop: 4,
        color: '#666',
    },
    sessionDate: {
        marginTop: 2,
        color: '#999',
        fontSize: 12,
    },
    sessionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    raceBadge: {
        backgroundColor: 'rgba(225, 6, 0, 0.12)',
    },
    qualiBadge: {
        backgroundColor: 'rgba(0, 89, 193, 0.12)',
    },
    sessionBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    raceBadgeText: {
        color: '#E10600',
    },
    qualiBadgeText: {
        color: '#0059C1',
    },
    resultRow: {
        flexDirection: 'row',
        marginTop: 14,
    },
    resultChip: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E2E2E2',
    },
    resultChipSpacing: {
        marginRight: 8,
    },
    resultLabel: {
        fontSize: 11,
        color: '#8D8D8D',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    resultValue: {
        marginTop: 4,
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    sessionStatsRow: {
        flexDirection: 'row',
        marginTop: 16,
    },
    sessionStat: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E6E6E6',
    },
    sessionStatSpacing: {
        marginRight: 10,
    },
    sessionStatLabel: {
        fontSize: 11,
        color: '#8C8C8C',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sessionStatValue: {
        marginTop: 6,
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
});
