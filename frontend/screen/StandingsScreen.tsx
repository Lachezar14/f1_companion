import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../theme/tokens';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    LayoutChangeEvent,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    getDriverChampionshipStandings,
    getTeamChampionshipStandings,
} from '../../backend/service/openf1Service';
import type {
    ChampionshipTeam,
    Driver,
    DriverChampionshipStanding,
} from '../../backend/types';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { getTeamColorHex } from '../../utils/driver';

type StandingsTab = 'drivers' | 'teams';

const SEGMENTS: Array<{ key: StandingsTab; label: string; icon: string }> = [
    { key: 'drivers', label: 'Drivers', icon: 'account' },
    { key: 'teams', label: 'Teams', icon: 'factory' },
];
const SEGMENT_CONTAINER_PADDING = 6;

const StandingsScreen = () => {
    const [activeTab, setActiveTab] = useState<StandingsTab>('drivers');
    const tabBarHeight = useBottomTabBarHeight();
    const segmentProgress = useRef(new Animated.Value(0)).current;
    const [segmentWidth, setSegmentWidth] = useState(0);
    const activeTabIndex = SEGMENTS.findIndex(segment => segment.key === activeTab);

    const handleSegmentsLayout = useCallback((event: LayoutChangeEvent) => {
        const containerWidth = event.nativeEvent.layout.width;
        const nextSegmentWidth = (containerWidth - SEGMENT_CONTAINER_PADDING * 2) / SEGMENTS.length;
        setSegmentWidth(Math.max(nextSegmentWidth, 0));
    }, []);

    useEffect(() => {
        Animated.spring(segmentProgress, {
            toValue: Math.max(activeTabIndex, 0),
            useNativeDriver: true,
            stiffness: 220,
            damping: 24,
            mass: 0.95,
        }).start();
    }, [activeTabIndex, segmentProgress]);

    const {
        data: driverData,
        loading: driversLoading,
        error: driversError,
        refreshing: driversRefreshing,
        reload: reloadDrivers,
        refresh: refreshDrivers,
    } = useServiceRequest<DriverChampionshipStanding[]>(getDriverChampionshipStandings, []);

    const {
        data: teamData,
        loading: teamsLoading,
        error: teamsError,
        refreshing: teamsRefreshing,
        reload: reloadTeams,
        refresh: refreshTeams,
    } = useServiceRequest<ChampionshipTeam[]>(getTeamChampionshipStandings, []);

    const driverStandings = driverData ?? [];
    const teamStandings = teamData ?? [];

    const teamColorMap = useMemo(() => {
        const map = new Map<string, string>();
        driverStandings.forEach(entry => {
            const teamName = entry.driver?.team_name;
            const teamColor = entry.driver?.team_colour;
            if (teamName && teamColor && !map.has(teamName)) {
                map.set(teamName, teamColor);
            }
        });
        return map;
    }, [driverStandings]);

    const segments = useMemo(
        () =>
            SEGMENTS.map(segment => {
                const isActive = segment.key === activeTab;
                return (
                    <TouchableOpacity
                        key={segment.key}
                        onPress={() => setActiveTab(segment.key)}
                        activeOpacity={0.92}
                        style={styles.segmentButton}
                    >
                        <MaterialCommunityIcons
                            name={segment.icon as any}
                            size={18}
                            color={isActive ? semanticColors.surface : '#8C8D9A'}
                            style={styles.segmentIcon}
                        />
                        <Text
                            style={[
                                styles.segmentLabel,
                                isActive && styles.segmentLabelActive,
                            ]}
                        >
                            {segment.label}
                        </Text>
                    </TouchableOpacity>
                );
            }),
        [activeTab]
    );

    const renderDriverRow = ({ item }: { item: DriverChampionshipStanding }) => {
        const driver: Driver | null = item.driver ?? null;
        const teamColor = driver?.team_colour
            ? getTeamColorHex(driver.team_colour)
            : semanticColors.textPrimary;

        return (
            <View style={styles.rowCard}>
                <View style={[styles.positionBadge, { backgroundColor: teamColor }]}> 
                    <Text style={styles.positionText}>P{item.position_current}</Text>
                </View>
                {driver?.headshot_url ? (
                    <Image source={{ uri: driver.headshot_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>
                            {driver?.last_name?.[0] ?? '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>
                        {driver?.full_name ?? `Driver #${item.driver_number}`}
                    </Text>
                    <Text style={styles.rowSubtitle}>{driver?.team_name ?? '—'}</Text>
                </View>
                <View style={styles.pointsBlock}>
                    <Text style={styles.pointsValue}>{item.points_current}</Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                </View>
            </View>
        );
    };

    const renderTeamRow = ({ item }: { item: ChampionshipTeam }) => {
        const rawColor = teamColorMap.get(item.team_name) ?? null;
        const teamColor = rawColor ? getTeamColorHex(rawColor) : semanticColors.textPrimary;

        return (
            <View style={styles.rowCard}>
                <View style={[styles.positionBadge, { backgroundColor: teamColor }]}> 
                    <Text style={styles.positionText}>P{item.position_current}</Text>
                </View>
                <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>{item.team_name}</Text>
                    <Text style={styles.rowSubtitle}>Constructors</Text>
                </View>
                <View style={styles.pointsBlock}>
                    <Text style={styles.pointsValue}>{item.points_current}</Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                </View>
            </View>
        );
    };

    const renderHero = (tab: StandingsTab) => {
        const source = tab === 'drivers' ? driverStandings : teamStandings;
        const leader = source[0];
        const leaderName =
            tab === 'drivers'
                ? (leader as DriverChampionshipStanding | undefined)?.driver?.full_name ??
                (leader ? `Driver #${(leader as DriverChampionshipStanding).driver_number}` : null)
                : (leader as ChampionshipTeam | undefined)?.team_name ?? null;

        return (
            <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>World Championship</Text>
                <Text style={styles.heroSubtitle}>
                    {tab === 'drivers' ? 'Driver Standings' : 'Constructors Standings'}
                </Text>
                {leader && leaderName ? (
                    <View style={styles.heroLeaderBlock}>
                        <Text style={styles.heroLeaderLabel}>Current leader</Text>
                        <Text style={styles.heroLeaderName}>{leaderName}</Text>
                        <Text style={styles.heroLeaderPoints}>
                            {leader.points_current} pts
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.heroPlaceholder}>
                        Standings will appear once data is available.
                    </Text>
                )}
            </View>
        );
    };

    const renderListHeader = (tab: StandingsTab) => (
        <View style={styles.listHeader}>
            {renderHero(tab)}
            <Text style={styles.listTitle}>
                {tab === 'drivers' ? 'Driver Classification' : 'Team Classification'}
            </Text>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No standings yet</Text>
            <Text style={styles.emptySubtitle}>
                Data not available for this championship view right now.
            </Text>
        </View>
    );

    const renderErrorState = (message: string, onRetry: () => void) => (
        <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Unable to load standings</Text>
            <Text style={styles.errorMessage}>{message}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLoadingState = () => (
        <View style={styles.centerState}>
            <ActivityIndicator size="large" color={semanticColors.danger} />
            <Text style={styles.loadingText}>Loading standings…</Text>
        </View>
    );

    const renderList = (tab: StandingsTab) => {
        const isDrivers = tab === 'drivers';
        const data = isDrivers ? driverStandings : teamStandings;
        const loading = isDrivers ? driversLoading : teamsLoading;
        const error = isDrivers ? driversError : teamsError;
        const refreshing = isDrivers ? driversRefreshing : teamsRefreshing;
        const refresh = isDrivers ? refreshDrivers : refreshTeams;
        const reload = isDrivers ? reloadDrivers : reloadTeams;

        if (loading && !data.length) {
            return renderLoadingState();
        }

        if (error) {
            return renderErrorState(error, reload);
        }

        if (isDrivers) {
            return (
                <FlatList<DriverChampionshipStanding>
                    data={driverStandings}
                    keyExtractor={item => item.driver_number.toString()}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: tabBarHeight + 28 },
                    ]}
                    renderItem={renderDriverRow}
                    ListHeaderComponent={renderListHeader('drivers')}
                    ListEmptyComponent={!loading ? renderEmptyState : undefined}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refresh}
                            tintColor={semanticColors.danger}
                        />
                    }
                />
            );
        }

        return (
            <FlatList<ChampionshipTeam>
                data={teamStandings}
                keyExtractor={item => item.team_name}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: tabBarHeight + 28 },
                ]}
                renderItem={renderTeamRow}
                ListHeaderComponent={renderListHeader('teams')}
                ListEmptyComponent={!loading ? renderEmptyState : undefined}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={semanticColors.danger}
                    />
                }
            />
        );
    };

    const indicatorTranslateX = Animated.multiply(segmentProgress, segmentWidth);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.segmentWrapper}>
                <Text style={styles.screenTitle}>Standings</Text>
                <View onLayout={handleSegmentsLayout} style={styles.segmentContainer}>
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.segmentIndicator,
                            {
                                width: segmentWidth,
                                transform: [{ translateX: indicatorTranslateX }],
                            },
                        ]}
                    />
                    {segments}
                </View>
            </View>
            <View style={styles.listWrapper}>{renderList(activeTab)}</View>
        </SafeAreaView>
    );
};

export default StandingsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    segmentWrapper: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
    },
    screenTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.sm,
    },
    segmentContainer: {
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#ECECF1',
        padding: SEGMENT_CONTAINER_PADDING,
        borderRadius: radius.lg,
    },
    segmentIndicator: {
        position: 'absolute',
        left: SEGMENT_CONTAINER_PADDING,
        top: SEGMENT_CONTAINER_PADDING,
        bottom: SEGMENT_CONTAINER_PADDING,
        borderRadius: radius.md,
        backgroundColor: semanticColors.textPrimary,
    },
    segmentButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
    },
    segmentLabel: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: '#8C8D9A',
    },
    segmentLabelActive: {
        color: semanticColors.surface,
    },
    segmentIcon: {
        marginRight: spacing.xs,
    },
    listWrapper: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
    },
    listHeader: {
        marginBottom: spacing.sm,
    },
    listTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: '#1E1E25',
        marginTop: spacing.sm,
    },
    heroCard: {
        backgroundColor: semanticColors.textPrimary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    heroTitle: {
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: typography.letterSpacing.wide,
        textTransform: 'uppercase',
    },
    heroSubtitle: {
        fontSize: typography.size.xxl,
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        marginTop: spacing.xxs,
    },
    heroLeaderBlock: {
        marginTop: 18,
        backgroundColor: overlays.white08,
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    heroLeaderLabel: {
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    heroLeaderName: {
        fontSize: typography.size.xl,
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        marginTop: spacing.xs,
    },
    heroLeaderPoints: {
        fontSize: typography.size.base,
        color: 'rgba(255,255,255,0.85)',
        marginTop: spacing.xs,
    },
    heroPlaceholder: {
        marginTop: 18,
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.sm,
    },
    rowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: semanticColors.surface,
        padding: spacing.md,
        borderRadius: radius.lg,
        marginBottom: spacing.sm,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        overflow: 'hidden',
    },
    positionBadge: {
        width: 48,
        height: 48,
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
        backgroundColor: '#ECECF1',
    },
    positionText: {
        color: semanticColors.textPrimary,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: radius.lg,
        marginRight: spacing.sm,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: radius.lg,
        backgroundColor: semanticColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    avatarInitial: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.surfaceInverse,
    },
    rowSubtitle: {
        fontSize: typography.size.sm,
        color: '#6B6C76',
        marginTop: 2,
    },
    pointsBlock: {
        alignItems: 'flex-end',
    },
    pointsValue: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surfaceInverse,
    },
    pointsLabel: {
        fontSize: typography.size.sm,
        color: '#6B6C76',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.surfaceInverse,
    },
    emptySubtitle: {
        fontSize: typography.size.sm,
        color: '#6B6C76',
        marginTop: spacing.xs,
        textAlign: 'center',
        paddingHorizontal: spacing.sm,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.sm,
        color: semanticColors.surfaceInverse,
    },
    errorTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.surfaceInverse,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.base,
        color: '#6B6C76',
        textAlign: 'center',
        paddingHorizontal: spacing.xxl,
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
    },
    retryText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.semibold,
    },
});
