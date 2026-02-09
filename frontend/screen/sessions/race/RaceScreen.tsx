import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useServiceRequest } from '../../../hooks/useServiceRequest';
import { calculateAvgLapTimePerCompound } from '../../../../utils/lap';
import { formatLapTime } from '../../../../shared/time';
import { getTeamColorHex } from '../../../../utils/driver';

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
    const [selectedDriverCompound, setSelectedDriverCompound] = useState<string | null>(null);
    const [selectedTeamCompound, setSelectedTeamCompound] = useState<string | null>(null);
    const [showAllTeams, setShowAllTeams] = useState(false);

    const safetyCarLapSet = useMemo(() => new Set(safetyCarLaps), [safetyCarLaps]);

    const raceLapCount = useMemo(() => {
        if (rows[0]?.laps) return rows[0].laps;
        return driverEntries.reduce((max, entry) => Math.max(max, entry.laps.length), 0);
    }, [rows, driverEntries]);

    const totalRaceLapsDisplay =
        typeof raceLapCount === 'number' && raceLapCount > 0 ? raceLapCount : '–';

    const safetyCarLapCount = safetyCarLaps.length;

    const averagePitStopsPerDriver = useMemo(() => {
        if (!driverEntries.length) return null;
        const totalStops = driverEntries.reduce(
            (sum, entry) => sum + (entry.pitStops?.length ?? 0),
            0
        );
        return totalStops / driverEntries.length;
    }, [driverEntries]);

    const avgPitStopsDisplay =
        averagePitStopsPerDriver != null ? averagePitStopsPerDriver.toFixed(1) : '–';

    const defaultDriverNumber = useMemo(() => {
        if (rows.length && rows[0]?.driverNumber) {
            return rows[0].driverNumber;
        }
        return driverEntries[0]?.driverNumber ?? null;
    }, [rows, driverEntries]);

    const driverOptionsPayload = useMemo(() => {
        const map = new Map<
            number,
            { driverNumber: number; name: string; team: string; teamColor?: string | null }
        >();
        driverEntries.forEach(entry => {
            map.set(entry.driverNumber, {
                driverNumber: entry.driverNumber,
                name: entry.driver.name,
                team: entry.driver.team,
                teamColor: entry.driver.teamColor,
            });
        });
        if (!map.size) return [];
        if (!rows.length) {
            return Array.from(map.values());
        }
        const ordered: {
            driverNumber: number;
            name: string;
            team: string;
            teamColor?: string | null;
        }[] = [];
        rows.forEach(row => {
            const option = map.get(row.driverNumber);
            if (option) {
                ordered.push(option);
                map.delete(row.driverNumber);
            }
        });
        map.forEach(option => ordered.push(option));
        return ordered;
    }, [driverEntries, rows]);

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
        if (compoundOptions.length === 0) {
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

    type DriverCompoundStat = {
        driverName: string;
        driverNumber: number;
        teamName: string;
        teamColor?: string | null;
        lapCount: number;
        avgTime: number;
    };

    const driverPaceByCompound = useMemo(() => {
        const map = new Map<string, DriverCompoundStat[]>();
        driverEntries.forEach(entry => {
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                excludedLapNumbers: safetyCarLapSet,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < 3) return;
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
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

    type TeamCompoundStat = {
        teamName: string;
        avgTime: number;
        color?: string | null;
    };

    const teamPaceByCompound = useMemo(() => {
        const compoundMap = new Map<
            string,
            Map<string, { total: number; count: number; color?: string | null }>
        >();
        driverEntries.forEach(entry => {
            const stats = calculateAvgLapTimePerCompound(entry.laps, entry.stints, {
                excludedLapNumbers: safetyCarLapSet,
            });
            stats.forEach(stat => {
                if (!stat.avgTime || stat.lapCount < 3) return;
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
    }, [driverEntries, safetyCarLapSet, compoundOptions]);

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

    type FastestPitStop = {
        duration: number;
        team: string;
        driver: string;
        lap: number | null;
    };

    const fastestPitStop = useMemo<FastestPitStop | null>(() => {
        let record: FastestPitStop | null = null;
        driverEntries.forEach(entry => {
            entry.pitStops?.forEach(stop => {
                if (typeof stop.stop_duration !== 'number' || stop.stop_duration <= 0) {
                    return;
                }
                if (!record || stop.stop_duration < record.duration) {
                    record = {
                        duration: stop.stop_duration,
                        team: entry.driver.team,
                        driver: entry.driver.name,
                        lap: stop.lap_number ?? null,
                    };
                }
            });
        });
        return record;
    }, [driverEntries]);

    const positionsGainedLeader = useMemo(() => {
        // Break ties by choosing the driver who finished higher overall
        let leader: {
            driverName: string;
            teamName: string;
            gain: number;
            start: number;
            finish: number;
        } | null = null;

        driverEntries.forEach(entry => {
            const start = entry.startingPosition;
            const finish = entry.sessionResult?.position;
            if (
                typeof start !== 'number' ||
                typeof finish !== 'number' ||
                start <= 0 ||
                finish <= 0
            ) {
                return;
            }
            const gain = start - finish;
            if (gain <= 0) {
                return;
            }
            if (
                !leader ||
                gain > leader.gain ||
                (gain === leader.gain && finish < leader.finish)
            ) {
                leader = {
                    driverName: entry.driver.name,
                    teamName: entry.driver.team,
                    gain,
                    start,
                    finish,
                };
            }
        });

        return leader;
    }, [driverEntries]);

    const insightsMetrics = [
        { label: 'Race Laps', value: totalRaceLapsDisplay },
        { label: 'SC Laps', value: safetyCarLapCount || '0' },
        { label: 'Avg Pit Stops', value: avgPitStopsDisplay },
    ];

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('RaceClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const handleOpenDriverData = useCallback(() => {
        if (!defaultDriverNumber) return;
        const driverDataEntry =
            driverEntries.find(entry => entry.driverNumber === defaultDriverNumber) ?? null;
        navigation.navigate('DriverOverview', {
            driverNumber: defaultDriverNumber,
            sessionKey,
            safetyCarLaps,
            driverData: driverDataEntry,
            driverOptions: driverOptionsPayload,
        });
    }, [defaultDriverNumber, driverEntries, driverOptionsPayload, navigation, safetyCarLaps, sessionKey]);

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

    const formatPace = (value?: number | null) =>
        typeof value === 'number' && value > 0 ? formatLapTime(value) : '—';

    const heroStats = [
        { label: 'Drivers', value: driverEntries.length || '–' },
        { label: 'SC Laps', value: safetyCarLapCount || '0' },
        { label: 'Laps', value: totalRaceLapsDisplay },
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
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    activeOpacity={0.9}
                    onPress={handleOpenClassification}
                >
                    <Text style={styles.actionButtonText}>Race Classification</Text>
                    <Text style={styles.actionButtonSubtitle}>
                        {rows.length || 0} {rows.length === 1 ? 'driver' : 'drivers'}
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
                        Dive into driver telemetry & laps
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.insightsCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardOverline}>Race Snapshot</Text>
                    <Text style={styles.cardTitle}>Strategy & Safety</Text>
                    <Text style={styles.cardSubtitle}>
                        Key metrics tracked live from timing data
                    </Text>
                </View>
                <View style={styles.metricRow}>
                    {insightsMetrics.map(metric => (
                        <View key={metric.label} style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metric.value}</Text>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                        </View>
                    ))}
                </View>
                {positionsGainedLeader ? (
                    <View style={styles.climberCard}>
                        <View style={styles.climberBadge}>
                            <Text style={styles.climberBadgeText}>Biggest Climber</Text>
                        </View>
                        <Text style={styles.climberDriver}>{positionsGainedLeader.driverName}</Text>
                        <Text style={styles.climberMeta}>
                            +{positionsGainedLeader.gain} positions • started P
                            {positionsGainedLeader.start} → finished P{positionsGainedLeader.finish}
                        </Text>
                        <Text style={styles.climberTeam}>{positionsGainedLeader.teamName}</Text>
                    </View>
                ) : null}
                <View style={styles.fastestPitCard}>
                    <View>
                        <Text style={styles.fastestPitLabel}>Fastest Pit Stop</Text>
                        <Text style={styles.fastestPitValue}>
                            {fastestPitStop ? `${fastestPitStop.duration.toFixed(2)}s` : '—'}
                        </Text>
                    </View>
                    <View style={styles.fastestPitMetaBlock}>
                        <Text style={styles.fastestPitMeta}>
                            {fastestPitStop ? fastestPitStop.team : 'No team data yet'}
                        </Text>
                        {fastestPitStop ? (
                            <Text style={styles.fastestPitMetaSecondary}>
                                {fastestPitStop.driver}
                                {fastestPitStop.lap ? ` • Lap ${fastestPitStop.lap}` : ''}
                            </Text>
                        ) : null}
                    </View>
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
                                        {option}
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
                                <Text style={styles.listMeta}>Average pace on {selectedTeamCompound}</Text>
                            </View>
                            <Text style={styles.listValue}>{formatPace(team.avgTime)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>
                        {selectedTeamCompound
                            ? `No representative team pace on ${selectedTeamCompound}`
                            : 'No team pace data'}
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
                    <Text style={styles.listTitle}>Top Driver Pace by Compound</Text>
                    <Text style={styles.listSubtitle}>Excludes pit exit & safety car laps</Text>
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
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}
                {selectedDriverCompound && driverLeaders.length ? (
                    driverLeaders.map((stat, index) => (
                        <View key={`${stat.driverNumber}-${selectedDriverCompound}`} style={styles.listRow}>
                            <View style={styles.rankPill}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.listDriverBlock}>
                                <Text style={styles.listDriverName}>{stat.driverName}</Text>
                                <Text style={styles.listMeta}>
                                    {stat.teamName} • {selectedDriverCompound} • {stat.lapCount}{' '}
                                    {stat.lapCount === 1 ? 'lap' : 'laps'}
                                </Text>
                            </View>
                            <Text style={styles.listValue}>{formatPace(stat.avgTime)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noData}>
                        {selectedDriverCompound
                            ? `No clean laps for ${selectedDriverCompound} yet`
                            : 'No compound data available'}
                    </Text>
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
    insightsCard: {
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
        justifyContent: 'space-between',
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
        fontSize: 22,
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
    fastestPitCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#F1F5FF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fastestPitLabel: {
        fontSize: 12,
        letterSpacing: 0.6,
        color: '#5A6AA3',
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    fastestPitValue: {
        marginTop: 4,
        fontSize: 24,
        fontWeight: '700',
        color: '#1B2C68',
    },
    fastestPitMetaBlock: {
        alignItems: 'flex-end',
    },
    fastestPitMeta: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B2C68',
    },
    fastestPitMetaSecondary: {
        fontSize: 12,
        color: '#5A6AA3',
        marginTop: 2,
    },
    climberCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FDF1F0',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#F5B7B1',
    },
    climberBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#FFE2DF',
        marginBottom: 8,
    },
    climberBadgeText: {
        fontSize: 11,
        color: '#D04B3E',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    climberDriver: {
        fontSize: 18,
        fontWeight: '700',
        color: '#A32A1F',
    },
    climberMeta: {
        marginTop: 4,
        fontSize: 13,
        color: '#A65E59',
    },
    climberTeam: {
        marginTop: 2,
        fontSize: 12,
        color: '#C27E77',
    },
    listCard: {
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 20,
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
    listHeader: {
        marginBottom: 12,
    },
    listTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    listSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#7A7E92',
    },
    filterScroll: {
        marginBottom: 8,
    },
    filterContent: {
        paddingVertical: 4,
    },
    filterChip: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D5DAE7',
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginRight: 8,
        backgroundColor: '#FFF',
    },
    filterChipActive: {
        backgroundColor: '#15151E',
        borderColor: '#15151E',
    },
    filterChipLabel: {
        fontSize: 13,
        color: '#6E738B',
        fontWeight: '600',
    },
    filterChipLabelActive: {
        color: '#FFF',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ECEFF5',
    },
    noData: {
        textAlign: 'center',
        color: '#8A8FA6',
        fontSize: 13,
        paddingVertical: 12,
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontWeight: '700',
        color: '#5C6BFF',
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    listMeta: {
        fontSize: 12,
        color: '#7A7E92',
        marginTop: 2,
    },
    listValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
        marginLeft: 12,
    },
    expandButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D5DAE7',
        alignItems: 'center',
        backgroundColor: '#F8FAFF',
    },
    expandButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2C2C34',
    },
    teamDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 12,
    },
    refreshHint: {
        paddingVertical: 24,
        textAlign: 'center',
        color: '#AAA',
    },
});
