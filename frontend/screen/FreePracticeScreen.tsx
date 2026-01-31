import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Session } from '../../backend/types';
import {
    getSessionResults,
    getDriversBySession,
    formatLapTime,
    getLapsBySession,
} from '../../backend/service/openf1Service';
import DriverCard from '../component/session/DriverCard';
import { theme } from '../../theme';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

interface DriverSessionData {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    lapCount: number;
    fastestLap: string | null;
    fastestLapRaw: number | null;
    dnf: boolean;
    dns: boolean;
    dsq: boolean;
    teamColor?: string;
}

interface FreePracticeData {
    session: Session | null;
    drivers: DriverSessionData[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

export default function FreePracticeScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const [state, setState] = useState<FreePracticeData>({
        session: null,
        drivers: [],
        loading: true,
        refreshing: false,
        error: null,
    });

    useEffect(() => {
        fetchDetails();
    }, [sessionKey, sessionName]);

    /**
     * OPTIMIZED: Fetch all data in just 3 API calls
     * Before: 2 + (20 drivers × 1) = 22 API calls
     * After: 3 API calls total
     */
    const fetchDetails = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                // Make only 3 API calls instead of 20+
                const [sessionResults, drivers, allLaps] = await Promise.all([
                    getSessionResults(sessionKey),
                    getDriversBySession(sessionKey),
                    getLapsBySession(sessionKey),
                ]);

                if (!sessionResults || !drivers) {
                    setState({
                        session: null,
                        drivers: [],
                        loading: false,
                        refreshing: false,
                        error: 'Failed to load session data',
                    });
                    return;
                }

                // Create driver lookup map
                const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

                // Group laps by driver and calculate stats (all done locally, no API calls)
                const lapsByDriver = new Map<number, { count: number; fastest: number | null }>();

                allLaps.forEach(lap => {
                    if (!lapsByDriver.has(lap.driver_number)) {
                        lapsByDriver.set(lap.driver_number, { count: 0, fastest: null });
                    }

                    const driverLaps = lapsByDriver.get(lap.driver_number)!;
                    driverLaps.count++;

                    // Track fastest lap
                    if (lap.lap_duration != null && lap.lap_duration > 0) {
                        if (driverLaps.fastest === null || lap.lap_duration < driverLaps.fastest) {
                            driverLaps.fastest = lap.lap_duration;
                        }
                    }
                });

                // Build driver data array
                const driverData = sessionResults
                    .map(result => {
                        const driver = driverMap.get(result.driver_number);

                        if (!driver) {
                            return null;
                        }

                        const lapData = lapsByDriver.get(result.driver_number);
                        const lapCount = lapData?.count || 0;
                        const fastestLapRaw = lapData?.fastest ?? null;
                        const fastestLap = fastestLapRaw ? formatLapTime(fastestLapRaw) : null;

                        return {
                            position: result.position,
                            driverNumber: result.driver_number,
                            driverName: driver.full_name,
                            teamName: driver.team_name,
                            lapCount,
                            fastestLap,
                            fastestLapRaw,
                            dnf: result.dnf || false,
                            dns: result.dns || false,
                            dsq: result.dsq || false,
                            teamColor: driver.team_colour,
                        };
                    })
                    .filter((d): d is DriverSessionData => d !== null);

                // Sort by position
                driverData.sort((a, b) => {
                    if (a.position === null && b.position === null) return 0;
                    if (a.position === null) return 1;
                    if (b.position === null) return -1;
                    return a.position - b.position;
                });

                setState({
                    session: null,
                    drivers: driverData,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                console.error('[SessionDetailsScreen] Error fetching details:', error);
                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load session details',
                }));
            }
        },
        [sessionKey]
    );

    const handleRefresh = useCallback(() => {
        fetchDetails(true);
    }, [fetchDetails]);

    const handleRetry = useCallback(() => {
        fetchDetails(false);
    }, [fetchDetails]);

    const sessionStats = useMemo(() => {
        if (!state.drivers.length) {
            return {
                totalDrivers: 0,
                totalLaps: 0,
                averageLaps: 0,
                bestLapRaw: null as number | null,
                bestLapDriver: null as string | null,
            };
        }

        let totalLaps = 0;
        let bestLapRaw: number | null = null;
        let bestLapDriver: string | null = null;

        state.drivers.forEach(driver => {
            totalLaps += driver.lapCount;

            if (
                driver.fastestLapRaw !== null &&
                (bestLapRaw === null || driver.fastestLapRaw < bestLapRaw)
            ) {
                bestLapRaw = driver.fastestLapRaw;
                bestLapDriver = driver.driverName;
            }
        });

        return {
            totalDrivers: state.drivers.length,
            totalLaps,
            averageLaps: totalLaps / state.drivers.length,
            bestLapRaw,
            bestLapDriver,
        };
    }, [state.drivers]);

    const formattedBestLap = sessionStats.bestLapRaw
        ? formatLapTime(sessionStats.bestLapRaw)
        : null;

    // Loading state
    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.colors.primary.red} />
                <Text style={styles.loadingText}>Loading session details...</Text>
            </View>
        );
    }

    // Error state
    if (state.error) {
        return (
            <View style={styles.center}>
                <Ionicons
                    name="alert-circle"
                    size={36}
                    color={theme.colors.semantic.danger}
                />
                <Text style={styles.errorTitle}>Unable to Load Data</Text>
                <Text style={styles.errorMessage}>{state.error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primary.red}
                    colors={[theme.colors.primary.red]}
                />
            }
        >
            {/* Hero Section */}
            <LinearGradient
                colors={[theme.colors.primary.red, theme.colors.primary.darkRed]}
                style={styles.hero}
            >
                <View style={styles.heroBadge}>
                    <Ionicons
                        name="flash"
                        size={14}
                        color={theme.colors.neutral.white}
                    />
                    <Text style={styles.heroBadgeText}>FREE PRACTICE</Text>
                </View>

                <Text style={styles.heroTitle}>{sessionName}</Text>
                {meetingName && <Text style={styles.heroSubtitle}>{meetingName}</Text>}

                <View style={styles.heroMetaRow}>
                    <View style={styles.heroMetaItem}>
                        <Ionicons
                            name="people"
                            size={16}
                            color={theme.colors.neutral.white}
                        />
                        <Text style={styles.heroMetaText}>
                            {sessionStats.totalDrivers} Drivers
                        </Text>
                    </View>
                    <View style={styles.heroMetaDivider} />
                    <View style={styles.heroMetaItem}>
                        <Ionicons
                            name="flag"
                            size={16}
                            color={theme.colors.neutral.white}
                        />
                        <Text style={styles.heroMetaText}>
                            {sessionStats.totalLaps} Total Laps
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Stats Section */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: theme.colors.semantic.info }] }>
                        <Ionicons name="speedometer" size={16} color={theme.colors.neutral.white} />
                    </View>
                    <Text style={styles.statLabel}>Average Laps</Text>
                    <Text style={styles.statValue}>
                        {sessionStats.averageLaps ? sessionStats.averageLaps.toFixed(1) : '-'}
                    </Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: theme.colors.semantic.success }] }>
                        <Ionicons name="timer" size={16} color={theme.colors.neutral.white} />
                    </View>
                    <Text style={styles.statLabel}>Best Lap</Text>
                    <Text style={styles.statValue}>{formattedBestLap || '-'}</Text>
                    {sessionStats.bestLapDriver && (
                        <Text style={styles.statMeta}>{sessionStats.bestLapDriver}</Text>
                    )}
                </View>
            </View>

            {/* Driver Timetable */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons
                            name="analytics"
                            size={18}
                            color={theme.colors.primary.red}
                        />
                        <Text style={styles.sectionTitle}>Session Results</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>Tap a driver to inspect laps</Text>
                </View>

                {state.drivers.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, styles.tableHeaderPos]}>Pos</Text>
                            <Text style={[styles.tableHeaderText, styles.tableHeaderDriver]}>Driver</Text>
                            <Text style={[styles.tableHeaderText, styles.tableHeaderLaps]}>Laps</Text>
                            <Text style={[styles.tableHeaderText, styles.tableHeaderTime]}>Best</Text>
                        </View>

                        {state.drivers.map((driver, index) => (
                            <DriverCard
                                key={driver.driverNumber}
                                driver={driver}
                                sessionKey={sessionKey}
                                isFirst={driver.position === 1}
                                index={index}
                            />
                        ))}
                    </>
                ) : (
                    <View style={styles.noDataCard}>
                        <Ionicons
                            name="information-circle"
                            size={20}
                            color={theme.colors.text.tertiary}
                        />
                        <Text style={styles.noData}>No session data available</Text>
                    </View>
                )}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    content: {
        paddingBottom: theme.spacing['3xl'],
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing['2xl'],
        backgroundColor: theme.colors.background.primary,
    },
    loadingText: {
        marginTop: theme.spacing.sm,
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
    },
    errorTitle: {
        marginTop: theme.spacing.md,
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
    },
    errorMessage: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
    },
    retryButton: {
        backgroundColor: theme.colors.primary.red,
        paddingHorizontal: theme.spacing['2xl'],
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
    },
    retryButtonText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.bold,
    },
    hero: {
        margin: theme.spacing.base,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing['2xl'],
        ...theme.shadows.md,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: theme.borderRadius.full,
        marginBottom: theme.spacing.sm,
    },
    heroBadgeText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        marginLeft: theme.spacing.xs,
        letterSpacing: theme.typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: theme.typography.fontSize['4xl'],
        fontWeight: theme.typography.fontWeight.black,
        color: theme.colors.neutral.white,
        letterSpacing: theme.typography.letterSpacing.tight,
    },
    heroSubtitle: {
        fontSize: theme.typography.fontSize.base,
        color: 'rgba(255,255,255,0.85)',
        marginTop: theme.spacing.xs,
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.lg,
    },
    heroMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    heroMetaText: {
        color: theme.colors.neutral.white,
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.medium,
    },
    heroMetaDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: theme.spacing.base,
    },
    statsRow: {
        flexDirection: 'row',
        gap: theme.spacing.base,
        paddingHorizontal: theme.spacing.base,
        marginTop: theme.spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        ...theme.shadows.sm,
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    statLabel: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
        marginBottom: theme.spacing.xs,
    },
    statValue: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
    },
    statMeta: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
    },
    sectionCard: {
        marginTop: theme.spacing['2xl'],
        marginHorizontal: theme.spacing.base,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.base,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        ...theme.shadows.md,
    },
    sectionHeader: {
        marginBottom: theme.spacing.lg,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    sectionTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
    },
    sectionSubtitle: {
        marginTop: theme.spacing.xs,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background.tertiary,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        marginBottom: theme.spacing.md,
    },
    tableHeaderText: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
    },
    tableHeaderPos: {
        width: 50,
    },
    tableHeaderDriver: {
        flex: 1,
    },
    tableHeaderLaps: {
        width: 60,
        textAlign: 'center',
    },
    tableHeaderTime: {
        width: 70,
        textAlign: 'right',
    },
    noDataCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
    },
    noData: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text.secondary,
    },
    refreshHint: {
        marginTop: theme.spacing['2xl'],
        textAlign: 'center',
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
    },
});
