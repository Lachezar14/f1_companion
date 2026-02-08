import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const StandingsScreen = () => {
    const [activeTab, setActiveTab] = useState<StandingsTab>('drivers');

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
                        style={[
                            styles.segmentButton,
                            isActive && styles.segmentButtonActive,
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={segment.icon as any}
                            size={18}
                            color={isActive ? '#FFFFFF' : '#8C8D9A'}
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
            : '#15151E';

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
        const teamColor = rawColor ? getTeamColorHex(rawColor) : '#15151E';

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
            <ActivityIndicator size="large" color="#E10600" />
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
                    contentContainerStyle={styles.listContent}
                    renderItem={renderDriverRow}
                    ListHeaderComponent={renderListHeader('drivers')}
                    ListEmptyComponent={!loading ? renderEmptyState : undefined}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refresh}
                            tintColor="#E10600"
                        />
                    }
                />
            );
        }

        return (
            <FlatList<ChampionshipTeam>
                data={teamStandings}
                keyExtractor={item => item.team_name}
                contentContainerStyle={styles.listContent}
                renderItem={renderTeamRow}
                ListHeaderComponent={renderListHeader('teams')}
                ListEmptyComponent={!loading ? renderEmptyState : undefined}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#E10600"
                    />
                }
            />
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.segmentWrapper}>
                <Text style={styles.screenTitle}>Standings</Text>
                <View style={styles.segmentContainer}>{segments}</View>
            </View>
            <View style={styles.listWrapper}>{renderList(activeTab)}</View>
        </SafeAreaView>
    );
};

export default StandingsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    segmentWrapper: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    screenTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#15151E',
        marginBottom: 12,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#ECECF1',
        padding: 6,
        borderRadius: 18,
    },
    segmentButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    segmentButtonActive: {
        backgroundColor: '#15151E',
    },
    segmentLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8C8D9A',
    },
    segmentLabelActive: {
        color: '#FFFFFF',
    },
    segmentIcon: {
        marginRight: 6,
    },
    listWrapper: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    listHeader: {
        marginBottom: 12,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E25',
        marginTop: 12,
    },
    heroCard: {
        backgroundColor: '#15151E',
        borderRadius: 22,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    heroTitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    heroSubtitle: {
        fontSize: 24,
        color: '#FFFFFF',
        fontWeight: '700',
        marginTop: 4,
    },
    heroLeaderBlock: {
        marginTop: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 16,
    },
    heroLeaderLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    heroLeaderName: {
        fontSize: 20,
        color: '#FFFFFF',
        fontWeight: '700',
        marginTop: 6,
    },
    heroLeaderPoints: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 6,
    },
    heroPlaceholder: {
        marginTop: 18,
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
    },
    rowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 18,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        overflow: 'hidden',
    },
    positionBadge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: '#ECECF1',
    },
    positionText: {
        color: '#15151E',
        fontSize: 14,
        fontWeight: '700',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
        marginRight: 12,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#EEE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '700',
        color: '#15151E',
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111120',
    },
    rowSubtitle: {
        fontSize: 13,
        color: '#6B6C76',
        marginTop: 2,
    },
    pointsBlock: {
        alignItems: 'flex-end',
    },
    pointsValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111120',
    },
    pointsLabel: {
        fontSize: 12,
        color: '#6B6C76',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111120',
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#6B6C76',
        marginTop: 6,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#111120',
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111120',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        color: '#6B6C76',
        textAlign: 'center',
        paddingHorizontal: 32,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#E10600',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 999,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
