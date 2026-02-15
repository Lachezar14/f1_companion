import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    colors,
    overlays,
    radius,
    semanticColors,
    shadows,
    spacing,
    typography,
} from '../theme/tokens';
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
                            size={17}
                            color={isActive ? semanticColors.surface : 'rgba(255,255,255,0.6)'}
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
            : colors.brand.primary;

        return (
            <View style={styles.rowCard}>
                <View style={[styles.rowStripe, { backgroundColor: teamColor }]} />

                <View style={[styles.positionBadge, { borderColor: teamColor }]}> 
                    <Text style={[styles.positionText, { color: teamColor }]}>P{item.position_current}</Text>
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
                    <Text style={styles.rowTitle} numberOfLines={1}>
                        {driver?.full_name ?? `Driver #${item.driver_number}`}
                    </Text>
                    <View style={styles.rowMeta}>
                        <MaterialCommunityIcons name="shield-outline" size={12} color="rgba(255,255,255,0.74)" />
                        <Text style={styles.rowSubtitle} numberOfLines={1}>{driver?.team_name ?? '—'}</Text>
                    </View>
                </View>

                <View style={styles.pointsBlock}>
                    <Text style={styles.pointsValue}>{item.points_current}</Text>
                    <Text style={styles.pointsLabel}>PTS</Text>
                </View>
            </View>
        );
    };

    const renderTeamRow = ({ item }: { item: ChampionshipTeam }) => {
        const rawColor = teamColorMap.get(item.team_name) ?? null;
        const teamColor = rawColor ? getTeamColorHex(rawColor) : colors.brand.primary;

        return (
            <View style={styles.rowCard}>
                <View style={[styles.rowStripe, { backgroundColor: teamColor }]} />

                <View style={[styles.positionBadge, { borderColor: teamColor }]}> 
                    <Text style={[styles.positionText, { color: teamColor }]}>P{item.position_current}</Text>
                </View>

                <View style={styles.teamIconBlock}>
                    <MaterialCommunityIcons name="factory" size={18} color="rgba(255,255,255,0.86)" />
                </View>

                <View style={styles.rowContent}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.team_name}</Text>
                    <View style={styles.rowMeta}>
                        <MaterialCommunityIcons name="trophy-outline" size={12} color="rgba(255,255,255,0.74)" />
                        <Text style={styles.rowSubtitle}>Constructors</Text>
                    </View>
                </View>

                <View style={styles.pointsBlock}>
                    <Text style={styles.pointsValue}>{item.points_current}</Text>
                    <Text style={styles.pointsLabel}>PTS</Text>
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
                <View style={styles.heroRail} />
                <View style={styles.heroTopRow}>
                    <Text style={styles.heroEyebrow}>POINTS RACE</Text>
                    <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{tab === 'drivers' ? 'DRIVERS' : 'TEAMS'}</Text>
                    </View>
                </View>

                <Text style={styles.heroTitle}>Championship Standings</Text>
                <Text style={styles.heroSubtitle}>
                    {tab === 'drivers' ? 'Current driver order' : 'Current constructor order'}
                </Text>

                {leader && leaderName ? (
                    <View style={styles.heroLeaderBlock}>
                        <View style={styles.heroLeaderHeader}>
                            <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                            <Text style={styles.heroLeaderLabel}>Current leader</Text>
                        </View>
                        <Text style={styles.heroLeaderName}>{leaderName}</Text>
                        <Text style={styles.heroLeaderPoints}>{leader.points_current} pts</Text>
                    </View>
                ) : (
                    <Text style={styles.heroPlaceholder}>
                        Standings will appear once data is available.
                    </Text>
                )}
            </View>
        );
    };

    const renderListHeader = (tab: StandingsTab) => {
        const count = tab === 'drivers' ? driverStandings.length : teamStandings.length;

        return (
            <View style={styles.listHeader}>
                {renderHero(tab)}
                <View style={styles.listSectionHeader}>
                    <Text style={styles.listSectionTitle}>
                        {tab === 'drivers' ? 'Driver Classification' : 'Team Classification'}
                    </Text>
                    <View style={styles.listSectionCount}>
                        <Text style={styles.listSectionCountText}>{count}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No standings yet</Text>
            <Text style={styles.emptySubtitle}>
                Data not available for this view right now.
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
                    showsVerticalScrollIndicator={false}
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
                showsVerticalScrollIndicator={false}
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
                <Text style={styles.screenLabel}>CHAMPIONSHIP</Text>
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
        backgroundColor: semanticColors.backgroundMuted,
    },
    segmentWrapper: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    screenLabel: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textMuted,
        letterSpacing: typography.letterSpacing.widest,
        marginBottom: spacing.xxs,
    },
    screenTitle: {
        fontSize: typography.size.display,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.tight,
        color: semanticColors.textPrimary,
        marginBottom: spacing.sm,
    },
    segmentContainer: {
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.neutral.carbon,
        borderWidth: 1,
        borderColor: overlays.white12,
        padding: SEGMENT_CONTAINER_PADDING,
        borderRadius: radius.lg,
    },
    segmentIndicator: {
        position: 'absolute',
        left: SEGMENT_CONTAINER_PADDING,
        top: SEGMENT_CONTAINER_PADDING,
        bottom: SEGMENT_CONTAINER_PADDING,
        borderRadius: radius.md,
        backgroundColor: colors.brand.primary,
        ...shadows.glow,
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
        color: 'rgba(255,255,255,0.64)',
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
        paddingHorizontal: spacing.lg,
    },
    listHeader: {
        marginBottom: spacing.sm,
    },
    heroCard: {
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        overflow: 'hidden',
        ...shadows.level3,
    },
    heroRail: {
        position: 'absolute',
        left: spacing.lg,
        top: 0,
        height: 5,
        width: 92,
        borderBottomLeftRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
        backgroundColor: colors.brand.primary,
    },
    heroTopRow: {
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroEyebrow: {
        color: 'rgba(255,255,255,0.74)',
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.widest,
        fontWeight: typography.weight.semibold,
    },
    tabBadge: {
        borderRadius: radius.pill,
        backgroundColor: overlays.white10,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
    },
    tabBadgeText: {
        color: semanticColors.surface,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        color: semanticColors.surface,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.tight,
    },
    heroSubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: typography.letterSpacing.wide,
    },
    heroLeaderBlock: {
        marginTop: spacing.md,
        backgroundColor: overlays.white10,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        padding: spacing.md,
    },
    heroLeaderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroLeaderLabel: {
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.78)',
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        marginLeft: spacing.xs,
    },
    heroLeaderName: {
        fontSize: typography.size.xl,
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        marginTop: spacing.xs,
    },
    heroLeaderPoints: {
        fontSize: typography.size.base,
        color: 'rgba(255,255,255,0.88)',
        marginTop: spacing.xxs,
    },
    heroPlaceholder: {
        marginTop: spacing.md,
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.sm,
    },
    listSectionHeader: {
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    listSectionTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    listSectionCount: {
        minWidth: 32,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        backgroundColor: semanticColors.surface,
        borderWidth: 1,
        borderColor: semanticColors.borderStrong,
        alignItems: 'center',
    },
    listSectionCountText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    rowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: overlays.white12,
        overflow: 'hidden',
        minHeight: 88,
        ...shadows.level2,
    },
    rowStripe: {
        width: 4,
        alignSelf: 'stretch',
    },
    positionBadge: {
        minWidth: 50,
        marginLeft: spacing.sm,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        borderWidth: 1,
        alignItems: 'center',
    },
    positionText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        marginLeft: spacing.sm,
        backgroundColor: '#313444',
    },
    avatarPlaceholder: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: '#313444',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    avatarInitial: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    teamIconBlock: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: overlays.white10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    rowContent: {
        flex: 1,
        marginLeft: spacing.sm,
        marginRight: spacing.sm,
    },
    rowTitle: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    rowMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    rowSubtitle: {
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.76)',
        marginLeft: 5,
        flex: 1,
    },
    pointsBlock: {
        minWidth: 70,
        marginRight: spacing.sm,
        borderRadius: radius.md,
        alignItems: 'center',
        backgroundColor: overlays.white10,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    pointsValue: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    pointsLabel: {
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: typography.letterSpacing.wide,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.border,
        backgroundColor: semanticColors.surface,
        marginTop: spacing.sm,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    emptySubtitle: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
        marginTop: spacing.xs,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: semanticColors.textMuted,
        fontSize: typography.size.base,
    },
    errorTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        ...shadows.glow,
    },
    retryText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
});
