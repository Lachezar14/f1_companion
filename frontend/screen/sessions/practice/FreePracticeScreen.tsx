import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPracticeSessionDetail } from '../../../../backend/service/openf1Service';
import type { DriverSessionData, DriverOption } from "../../../component/practice/FreePracticeResultCard";
import { formatLapTime } from '../../../../shared/time';
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import type { PracticeSessionDetail } from '../../../../backend/types';
import { calculateAvgLapTimePerCompound, calculateTypicalLapDuration } from '../../../../utils/lap';
import { getTeamColorHex } from '../../../../utils/driver';
import { getCompoundName } from '../../../../utils/tyre';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

type NavigationProp = NativeStackNavigationProp<any>;

type DriverCompoundStat = {
    driverName: string;
    driverNumber: number;
    teamName: string;
    teamColor?: string | null;
    lapCount: number;
    avgTime: number;
};

type TeamCompoundStat = {
    teamName: string;
    avgTime: number;
    color?: string | null;
};

const MIN_PACE_LAP_THRESHOLD = 3;
const PRACTICE_PACE_THRESHOLD_FACTOR = 1.07;

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;
    const [selectedDriverCompound, setSelectedDriverCompound] = useState<string | null>(null);
    const [selectedTeamCompound, setSelectedTeamCompound] = useState<string | null>(null);
    const [showAllTeams, setShowAllTeams] = useState(false);

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
    const heroDate = data?.date_start
        ? new Date(data.date_start).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        })
        : null;

    const drivers: DriverSessionData[] = useMemo(
        () =>
            driverEntries
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
                }),
        [driverEntries]
    );

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

    const averageLapsPerDriver = driverEntries.length
        ? (totalLaps / driverEntries.length).toFixed(1)
        : '—';
    const totalStints = useMemo(
        () => driverEntries.reduce((total, entry) => total + entry.stints.length, 0),
        [driverEntries]
    );

    const compoundOptions = useMemo(() => {
        const set = new Set<string>();
        driverEntries.forEach(entry => {
            entry.stints.forEach(stint => {
                if (stint.compound) {
                    set.add(stint.compound.toUpperCase());
                }
            });
        });
        return Array.from(set);
    }, [driverEntries]);

    useEffect(() => {
        if (!compoundOptions.length) {
            setSelectedDriverCompound(null);
            setSelectedTeamCompound(null);
            setShowAllTeams(false);
            return;
        }
        setSelectedDriverCompound(prev =>
            prev && compoundOptions.includes(prev) ? prev : compoundOptions[0]
        );
        setSelectedTeamCompound(prev =>
            prev && compoundOptions.includes(prev) ? prev : compoundOptions[0]
        );
    }, [compoundOptions]);

    useEffect(() => {
        setShowAllTeams(false);
    }, [selectedTeamCompound]);

    const driverOptionsPayload = useMemo<DriverOption[]>(
        () =>
            drivers.map(driver => ({
                driverNumber: driver.driverNumber,
                name: driver.driverName,
                team: driver.teamName,
                teamColor: driver.teamColor,
            })),
        [drivers]
    );

    const defaultDriverNumber =
        driverOptionsPayload[0]?.driverNumber ?? driverEntries[0]?.driverNumber ?? null;

    const driverLapThresholds = useMemo(() => {
        const map = new Map<number, number | null>();
        driverEntries.forEach(entry => {
            const typicalLap = calculateTypicalLapDuration(entry.laps);
            map.set(
                entry.driverNumber,
                typicalLap ? typicalLap * PRACTICE_PACE_THRESHOLD_FACTOR : null
            );
        });
        return map;
    }, [driverEntries]);

    const driverPaceByCompound = useMemo(() => {
        const map = new Map<string, DriverCompoundStat[]>();
        driverEntries.forEach(entry => {
            const lapThreshold = driverLapThresholds.get(entry.driverNumber) ?? null;
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                lapThreshold: lapThreshold ?? undefined,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < MIN_PACE_LAP_THRESHOLD) return;
                const compound = stat.compound.toUpperCase();
                const driverList = map.get(compound) ?? [];
                driverList.push({
                    driverName: entry.driver.name,
                    driverNumber: entry.driverNumber,
                    teamName: entry.driver.team,
                    teamColor: entry.driver.teamColor,
                    lapCount: stat.lapCount,
                    avgTime: stat.avgTime,
                });
                map.set(compound, driverList);
            });
        });
        compoundOptions.forEach(compound => {
            if (!map.has(compound)) {
                map.set(compound, []);
            }
        });
        map.forEach((list, compound) => {
            list.sort((a, b) => a.avgTime - b.avgTime);
            map.set(compound, list.slice(0, 5));
        });
        return map;
    }, [driverEntries, compoundOptions, driverLapThresholds]);

    const teamPaceByCompound = useMemo(() => {
        const compoundMap = new Map<
            string,
            Map<string, { total: number; count: number; color?: string | null }>
        >();
        driverEntries.forEach(entry => {
            const lapThreshold = driverLapThresholds.get(entry.driverNumber) ?? null;
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                lapThreshold: lapThreshold ?? undefined,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < MIN_PACE_LAP_THRESHOLD) return;
                const compound = stat.compound.toUpperCase();
                const teamName = entry.driver.team;
                const totalTime = stat.avgTime * stat.lapCount;
                const compoundTeams = compoundMap.get(compound) ?? new Map();
                const agg = compoundTeams.get(teamName) ?? {
                    total: 0,
                    count: 0,
                    color: entry.driver.teamColor,
                };
                compoundTeams.set(teamName, {
                    total: agg.total + totalTime,
                    count: agg.count + stat.lapCount,
                    color: agg.color ?? entry.driver.teamColor,
                });
                compoundMap.set(compound, compoundTeams);
            });
        });

        const result = new Map<string, TeamCompoundStat[]>();
        compoundOptions.forEach(compound => {
            const aggregate = compoundMap.get(compound);
            if (!aggregate) {
                result.set(compound, []);
                return;
            }
            const teams: TeamCompoundStat[] = [];
            aggregate.forEach((value, teamName) => {
                if (!value.count) return;
                const avg = value.total / value.count;
                if (!Number.isFinite(avg)) return;
                teams.push({
                    teamName,
                    avgTime: avg,
                    color: value.color,
                });
            });
            teams.sort((a, b) => a.avgTime - b.avgTime);
            result.set(compound, teams);
        });

        return result;
    }, [driverEntries, compoundOptions, driverLapThresholds]);

    const driverLeaders =
        selectedDriverCompound && driverPaceByCompound.has(selectedDriverCompound)
            ? driverPaceByCompound.get(selectedDriverCompound) ?? []
            : [];
    const teamLeaders =
        selectedTeamCompound && teamPaceByCompound.has(selectedTeamCompound)
            ? teamPaceByCompound.get(selectedTeamCompound) ?? []
            : [];

    const displayedTeamLeaders = useMemo(() => {
        if (!teamLeaders.length) return [];
        return showAllTeams ? teamLeaders : teamLeaders.slice(0, 5);
    }, [teamLeaders, showAllTeams]);

    const heroStats = [
        { label: 'Drivers', value: driverEntries.length || '–' },
        { label: 'Fastest Lap', value: bestLapLabel },
        { label: 'Laps Logged', value: totalLaps || '0' },
    ];

    const insightsMetrics = [
        { label: 'Avg Laps/Driver', value: averageLapsPerDriver },
        { label: 'Compounds Used', value: compoundOptions.length || '0' },
        { label: 'Total Stints', value: totalStints || '0' },
    ];

    const formatPace = (value?: number | null) =>
        typeof value === 'number' && value > 0 ? formatLapTime(value) : '—';

    const selectedTeamCompoundName = selectedTeamCompound
        ? getCompoundName(selectedTeamCompound)
        : null;
    const selectedDriverCompoundName = selectedDriverCompound
        ? getCompoundName(selectedDriverCompound)
        : null;

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('PracticeClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const handleOpenDriverData = useCallback(() => {
        if (!defaultDriverNumber) return;
        const driverDataEntry =
            driverEntries.find(entry => entry.driverNumber === defaultDriverNumber) ?? null;
        navigation.navigate('DriverPracticeOverview', {
            driverNumber: defaultDriverNumber,
            sessionKey,
            driverData: driverDataEntry,
            driverOptions: driverOptionsPayload,
        });
    }, [defaultDriverNumber, driverEntries, driverOptionsPayload, navigation, sessionKey]);

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
                <View style={styles.heroContent}>
                    <Text style={styles.heroSubtitle}>{meetingName || sessionDetail?.location}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {heroDate ? <Text style={styles.heroDate}>{heroDate}</Text> : null}
                    <View style={styles.chipRow}>
                        {sessionDetail?.circuit_short_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{sessionDetail.circuit_short_name}</Text>
                            </View>
                        ) : null}
                        {sessionDetail?.country_name ? (
                            <View style={styles.chip}>
                                <Text style={styles.chipText}>{sessionDetail.country_name}</Text>
                            </View>
                        ) : null}
                        <View style={styles.chip}>
                            <Text style={styles.chipText}>{driverEntries.length} Drivers</Text>
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
                    <Text style={styles.actionButtonText}>Practice Classification</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {drivers.length} {drivers.length === 1 ? 'driver' : 'drivers'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        styles.actionButtonSecondary,
                        !defaultDriverNumber && styles.actionButtonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleOpenDriverData}
                    disabled={!defaultDriverNumber}
                >
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>Driver Data</Text>
                    <Text style={[styles.actionButtonSubtitle, styles.actionButtonSubtitleDark]}>
                        Review laps & tyre work
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.insightsCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Practice Snapshot</Text>
                    <Text style={styles.cardTitle}>Track Evolution & Workloads</Text>
                    <Text style={styles.cardSubtitle}>Key metrics from timing data</Text>
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

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Team Avg Pace by Compound</Text>
                    <Text style={styles.listSubtitle}>Combined average of both drivers</Text>
                </View>
                {compoundOptions.length ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundOptions.map(option => {
                            const isActive = option === selectedTeamCompound;
                            const label = getCompoundName(option);
                            return (
                                <TouchableOpacity
                                    key={`team-compound-${option}`}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => {
                                        if (option !== selectedTeamCompound) {
                                            setSelectedTeamCompound(option);
                                            setShowAllTeams(false);
                                        }
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            isActive && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}
                {selectedTeamCompound && displayedTeamLeaders.length ? (
                    displayedTeamLeaders.map(team => (
                        <View key={team.teamName} style={styles.listRow}>
                            <View style={[styles.teamDot, { backgroundColor: getTeamColorHex(team.color) }]} />
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{team.teamName}</Text>
                                <Text style={styles.listMeta}>
                                    Avg pace on {getCompoundName(selectedTeamCompound)}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>{formatPace(team.avgTime)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>
                        {selectedTeamCompoundName
                            ? `No representative pace on ${selectedTeamCompoundName}`
                            : 'No team pace data yet'}
                    </Text>
                )}
                {selectedTeamCompound && teamLeaders.length > 5 ? (
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowAllTeams(prev => !prev)}
                    >
                        <Text style={styles.expandButtonText}>
                            {showAllTeams ? 'Show Less' : 'Show All Teams'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Driver Pace by Compound</Text>
                    <Text style={styles.listSubtitle}>Excludes pit exit laps</Text>
                </View>
                {compoundOptions.length ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                    >
                        {compoundOptions.map(option => {
                            const isActive = option === selectedDriverCompound;
                            const label = getCompoundName(option);
                            return (
                                <TouchableOpacity
                                    key={`driver-compound-${option}`}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => setSelectedDriverCompound(option)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipLabel,
                                            isActive && styles.filterChipLabelActive,
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}
                {selectedDriverCompound && driverLeaders.length ? (
                    driverLeaders.map((stat, index) => (
                        <View
                            key={`${stat.driverNumber}-${selectedDriverCompound}`}
                            style={styles.listRow}
                        >
                            <View style={styles.rankPill}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{stat.driverName}</Text>
                                <Text style={styles.listMeta}>
                                    {stat.teamName} • {selectedDriverCompoundName ?? 'Unknown'} •{' '}
                                    {stat.lapCount} {stat.lapCount === 1 ? 'lap' : 'laps'}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>{formatPace(stat.avgTime)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>
                        {selectedDriverCompoundName
                            ? `No clean laps for ${selectedDriverCompoundName}`
                            : 'No driver pace data yet'}
                    </Text>
                )}
            </View>

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
        backgroundColor: '#1C1C27',
        borderRadius: 24,
        padding: 20,
        margin: 16,
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
        fontSize: 24,
        color: '#FFF',
        fontWeight: '700',
        marginTop: 6,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
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
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
        marginBottom: 4,
    },
    actionButton: {
        flex: 1,
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
    actionButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D9DFEA',
        shadowOpacity: 0.05,
    },
    actionButtonDisabled: {
        opacity: 0.5,
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
    actionButtonTextDark: {
        color: '#15151E',
    },
    actionButtonSubtitleDark: {
        color: '#6E738B',
    },
    insightsCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 5,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardOverline: {
        fontSize: 12,
        color: '#E10600',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#7C7C85',
        marginTop: 4,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#15151E',
    },
    metricLabel: {
        fontSize: 12,
        color: '#7C7C85',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 4,
    },
    listCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    listHeader: {
        marginBottom: 16,
    },
    listTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    listSubtitle: {
        fontSize: 14,
        color: '#7C7C85',
        marginTop: 4,
    },
    filterScroll: {
        marginHorizontal: -8,
        marginBottom: 12,
    },
    filterContent: {
        paddingHorizontal: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E0E3EF',
        marginRight: 8,
        backgroundColor: '#F7F8FB',
    },
    filterChipActive: {
        backgroundColor: '#15151E',
        borderColor: '#15151E',
    },
    filterChipLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B718F',
    },
    filterChipLabelActive: {
        color: '#FFFFFF',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    teamDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#15151E',
    },
    listMeta: {
        fontSize: 13,
        color: '#8B8FA9',
        marginTop: 2,
    },
    listValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
    },
    noData: {
        fontSize: 14,
        color: '#8B8FA9',
        textAlign: 'center',
        marginTop: 8,
    },
    expandButton: {
        marginTop: 8,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#F5F6FA',
        alignItems: 'center',
    },
    expandButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#15151E',
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EDEFF7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#15151E',
    },
    refreshHint: {
        fontSize: 12,
        color: '#CCC',
        textAlign: 'center',
        paddingVertical: 24,
    },
});
