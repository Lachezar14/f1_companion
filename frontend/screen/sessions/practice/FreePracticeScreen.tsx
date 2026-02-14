import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
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

type PaceViewMode = 'drivers' | 'teams';

const MIN_PACE_LAP_THRESHOLD = 3;
const PRACTICE_PACE_THRESHOLD_FACTOR = 1.07;
const DATA_NOT_YET_AVAILABLE = 'Data not yet available';

const asDisplayText = (value: string | null | undefined, fallback = DATA_NOT_YET_AVAILABLE) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
};

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;
    const [selectedDriverCompound, setSelectedDriverCompound] = useState<string | null>(null);
    const [selectedTeamCompound, setSelectedTeamCompound] = useState<string | null>(null);
    const [showAllTeams, setShowAllTeams] = useState(false);
    const [paceViewMode, setPaceViewMode] = useState<PaceViewMode>('drivers');

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

    const mostLapsDriver = useMemo(() => {
        if (!driverEntries.length) return null;
        return [...driverEntries]
            .map(entry => ({
                driverNumber: entry.driverNumber,
                driverName: entry.driver.name,
                teamName: entry.driver.team,
                lapCount: entry.laps.length,
            }))
            .sort(
                (a, b) =>
                    b.lapCount - a.lapCount ||
                    String(a.driverName ?? '').localeCompare(String(b.driverName ?? ''))
            )[0];
    }, [driverEntries]);

    const mostLapsTeam = useMemo(() => {
        if (!driverEntries.length) return null;
        const teamTotals = new Map<string, { teamName: string; lapCount: number; color?: string | null }>();
        driverEntries.forEach(entry => {
            const teamName = entry.driver.team;
            const existing = teamTotals.get(teamName) ?? {
                teamName,
                lapCount: 0,
                color: entry.driver.teamColor,
            };
            existing.lapCount += entry.laps.length;
            existing.color = existing.color ?? entry.driver.teamColor;
            teamTotals.set(teamName, existing);
        });
        return [...teamTotals.values()].sort(
            (a, b) =>
                b.lapCount - a.lapCount ||
                String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''))
        )[0] ?? null;
    }, [driverEntries]);

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
    const isTeamPaceView = paceViewMode === 'teams';

    const handleOpenClassification = useCallback(() => {
        navigation.navigate('PracticeClassification', {
            sessionKey,
            sessionName,
            meetingName,
        });
    }, [meetingName, navigation, sessionKey, sessionName]);

    const openDriverOverview = useCallback(
        (driverNumber?: number | null) => {
            if (!driverNumber) return;
            const driverDataEntry =
                driverEntries.find(entry => entry.driverNumber === driverNumber) ?? null;
            navigation.navigate('DriverPracticeOverview', {
                driverNumber,
                sessionKey,
                driverData: driverDataEntry,
                driverOptions: driverOptionsPayload,
            });
        },
        [driverEntries, driverOptionsPayload, navigation, sessionKey]
    );

    const handleOpenDriverData = useCallback(() => {
        if (!defaultDriverNumber) return;
        openDriverOverview(defaultDriverNumber);
    }, [defaultDriverNumber, openDriverOverview]);

    // Loading state
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
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
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
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
                <View style={styles.workloadRow}>
                    <View style={styles.workloadCard}>
                        <Text style={styles.workloadLabel}>Most Laps Driver</Text>
                        <Text style={styles.workloadValue}>
                            {mostLapsDriver
                                ? asDisplayText(mostLapsDriver.driverName)
                                : DATA_NOT_YET_AVAILABLE}
                        </Text>
                        <Text style={styles.workloadMeta}>
                            {mostLapsDriver
                                ? `${asDisplayText(mostLapsDriver.teamName)} • ${mostLapsDriver.lapCount} ${
                                      mostLapsDriver.lapCount === 1 ? 'lap' : 'laps'
                                  }`
                                : DATA_NOT_YET_AVAILABLE}
                        </Text>
                    </View>
                    <View style={styles.workloadCard}>
                        <Text style={styles.workloadLabel}>Most Laps Team</Text>
                        <View style={styles.workloadTeamRow}>
                            {mostLapsTeam ? (
                                <View
                                    style={[
                                        styles.workloadTeamDot,
                                        { backgroundColor: getTeamColorHex(mostLapsTeam.color) },
                                    ]}
                                />
                            ) : null}
                            <Text style={styles.workloadValue}>
                                {mostLapsTeam
                                    ? asDisplayText(mostLapsTeam.teamName)
                                    : DATA_NOT_YET_AVAILABLE}
                            </Text>
                        </View>
                        <Text style={styles.workloadMeta}>
                            {mostLapsTeam
                                ? `${mostLapsTeam.lapCount} ${
                                      mostLapsTeam.lapCount === 1 ? 'lap' : 'laps'
                                  } in total`
                                : DATA_NOT_YET_AVAILABLE}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.insightModeCard}>
                <Text style={styles.insightModeLabel}>Pace View</Text>
                <View style={styles.insightModeOptions}>
                    <TouchableOpacity
                        style={[styles.filterChip, isTeamPaceView && styles.filterChipActive]}
                        onPress={() => setPaceViewMode('teams')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                isTeamPaceView && styles.filterChipLabelActive,
                            ]}
                        >
                            Teams
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, !isTeamPaceView && styles.filterChipActive]}
                        onPress={() => setPaceViewMode('drivers')}
                    >
                        <Text
                            style={[
                                styles.filterChipLabel,
                                !isTeamPaceView && styles.filterChipLabelActive,
                            ]}
                        >
                            Drivers
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {isTeamPaceView ? (
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
                        displayedTeamLeaders.map((team, index) => (
                            <View key={`${team.teamName ?? 'team'}-${index}`} style={styles.listRow}>
                                <View
                                    style={[styles.teamDot, { backgroundColor: getTeamColorHex(team.color) }]}
                                />
                                <View style={styles.listDriverBlock}>
                                    <Text style={styles.listDriverName}>
                                        {asDisplayText(team.teamName)}
                                    </Text>
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
            ) : (
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
                                    <Text style={styles.listDriverName}>
                                        {asDisplayText(stat.driverName)}
                                    </Text>
                                    <Text style={styles.listMeta}>
                                        {asDisplayText(stat.teamName)} •{' '}
                                        {selectedDriverCompoundName ?? DATA_NOT_YET_AVAILABLE} •{' '}
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
                    {selectedDriverCompound && driverLeaders.length ? (
                        <TouchableOpacity
                            style={styles.expandButton}
                            onPress={() => openDriverOverview(driverLeaders[0]?.driverNumber)}
                        >
                            <Text style={styles.expandButtonText}>Open Driver Details</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.backgroundMuted,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.lg,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.lg,
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
    },
    heroCard: {
        backgroundColor: semanticColors.surfaceInverse,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        margin: spacing.md,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroContent: {
        marginBottom: spacing.md,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.base,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: typography.size.xxl,
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        marginTop: spacing.xs,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: spacing.xxs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: overlays.white15,
    },
    chipText: {
        color: semanticColors.surface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        letterSpacing: 0.4,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white08,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: typography.size.sm,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        marginTop: spacing.xxs,
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xxs,
    },
    actionButton: {
        flex: 1,
        borderRadius: radius.xl,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: semanticColors.textPrimary,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    actionButtonSecondary: {
        backgroundColor: semanticColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.borderStrong,
        shadowOpacity: 0.05,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    actionButtonSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    actionButtonTextDark: {
        color: semanticColors.textPrimary,
    },
    actionButtonSubtitleDark: {
        color: '#6E738B',
    },
    insightsCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.07,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 5,
    },
    cardHeader: {
        marginBottom: spacing.md,
    },
    cardOverline: {
        fontSize: typography.size.sm,
        color: semanticColors.danger,
        fontWeight: typography.weight.bold,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        marginBottom: spacing.xxs,
    },
    cardTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    cardSubtitle: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        marginTop: spacing.xxs,
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
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    metricLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        marginTop: spacing.xxs,
    },
    workloadRow: {
        marginTop: spacing.md,
        flexDirection: 'row',
        gap: spacing.sm,
    },
    workloadCard: {
        flex: 1,
        borderRadius: radius.lg,
        backgroundColor: '#F4F6FD',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2E7F3',
        padding: spacing.md,
    },
    workloadLabel: {
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: typography.weight.bold,
        color: '#6E738B',
    },
    workloadValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    workloadMeta: {
        marginTop: 3,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    workloadTeamRow: {
        marginTop: spacing.xxs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    workloadTeamDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    insightModeCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: semanticColors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    insightModeLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    insightModeOptions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    listHeader: {
        marginBottom: spacing.md,
    },
    listTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSubtitle: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        marginTop: spacing.xxs,
    },
    filterScroll: {
        marginHorizontal: -8,
        marginBottom: spacing.sm,
    },
    filterContent: {
        paddingHorizontal: spacing.xs,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E0E3EF',
        marginRight: spacing.xs,
        backgroundColor: semanticColors.surfaceMuted,
    },
    filterChipActive: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    filterChipLabel: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: '#6B718F',
    },
    filterChipLabelActive: {
        color: semanticColors.surface,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    teamDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.sm,
    },
    listDriverBlock: {
        flex: 1,
    },
    listDriverName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    listMeta: {
        fontSize: typography.size.sm,
        color: '#8B8FA9',
        marginTop: 2,
    },
    listValue: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    noData: {
        fontSize: typography.size.base,
        color: '#8B8FA9',
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    expandButton: {
        marginTop: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: '#F5F6FA',
        alignItems: 'center',
    },
    expandButtonText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    rankPill: {
        width: 32,
        height: 32,
        borderRadius: radius.lg,
        backgroundColor: '#EDEFF7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    rankText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    refreshHint: {
        fontSize: typography.size.sm,
        color: semanticColors.borderStrong,
        textAlign: 'center',
        paddingVertical: spacing.xl,
    },
});
