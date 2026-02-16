import React, { useCallback, useMemo } from 'react';
import { radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDriversBySession, getOvertakesBySession } from '../../../../backend/service/openf1Service';
import type { Driver, Overtake, SessionDriverData } from '../../../../backend/types';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
    overtakes?: Overtake[];
    driverEntries?: SessionDriverData[];
};

type DriverProfile = {
    number: number;
    name: string;
    shortName: string;
    team: string;
    teamColor?: string | null;
    headshotUrl?: string | null;
};

type OvertakeScreenData = {
    overtakes: Overtake[];
    drivers: Driver[];
};

const formatTime = (isoDate: string): string => {
    try {
        return new Date(isoDate).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return isoDate;
    }
};

const normalizeDriverFromEntry = (entry: SessionDriverData | null | undefined): DriverProfile | null => {
    if (!entry) return null;
    return {
        number: entry.driverNumber,
        name: entry.driver.name,
        shortName: entry.driver.shortName,
        team: entry.driver.team,
        teamColor: entry.driver.teamColor,
        headshotUrl: entry.driver.headshotUrl,
    };
};

const normalizeDriverFromApi = (driver: Driver | null | undefined): DriverProfile | null => {
    if (!driver) return null;
    return {
        number: driver.driver_number,
        name: driver.full_name,
        shortName: driver.name_acronym,
        team: driver.team_name,
        teamColor: driver.team_colour,
        headshotUrl: driver.headshot_url,
    };
};

const DriverAvatar = ({ profile }: { profile: DriverProfile | null }) => {
    if (!profile) {
        return (
            <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>?</Text>
            </View>
        );
    }

    if (profile.headshotUrl) {
        return <Image source={{ uri: profile.headshotUrl }} style={styles.avatar} />;
    }

    return (
        <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{profile.number}</Text>
        </View>
    );
};

const DriverInfo = ({ label, profile }: { label: string; profile: DriverProfile | null }) => (
    <View style={styles.driverInfo}>
        <Text style={styles.driverLabel}>{label}</Text>
        <Text style={styles.driverName}>{profile?.shortName ?? 'Unknown Driver'}</Text>
        <Text style={styles.driverTeam}>{profile?.team ?? 'Unavailable'}</Text>
    </View>
);

const OvertakeCard = ({
    overtake,
    overtakingDriver,
    overtakenDriver,
}: {
    overtake: Overtake;
    overtakingDriver: DriverProfile | null;
    overtakenDriver: DriverProfile | null;
}) => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Position {overtake.position}</Text>
            <Text style={styles.cardSubtitle}>{formatTime(overtake.date)}</Text>
        </View>
        <View style={styles.cardBody}>
            <DriverAvatar profile={overtakingDriver} />
            <DriverInfo label="Overtook" profile={overtakingDriver} />
            <View style={styles.chevronWrapper}>
                <MaterialCommunityIcons name="chevron-double-right" size={32} color={semanticColors.success} />
            </View>
            <DriverInfo label="Overtaken" profile={overtakenDriver} />
            <DriverAvatar profile={overtakenDriver} />
        </View>
    </View>
);

const RaceOvertakesScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        sessionKey,
        sessionName,
        meetingName,
        overtakes: overtakesParam = [],
        driverEntries = [],
    } = route.params;

    const loadData = useCallback(async (): Promise<OvertakeScreenData> => {
        const [overtakes, drivers] = await Promise.all([
            overtakesParam.length ? Promise.resolve(overtakesParam) : getOvertakesBySession(sessionKey),
            getDriversBySession(sessionKey),
        ]);

        return { overtakes, drivers };
    }, [overtakesParam, sessionKey]);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<OvertakeScreenData>(loadData, [loadData]);

    const heroSubtitle = meetingName ? `${meetingName} · ${sessionName}` : sessionName;
    const overtakes = data?.overtakes ?? [];

    const driverMap = useMemo(() => {
        const map: Record<number, DriverProfile> = {};

        driverEntries.forEach(entry => {
            const profile = normalizeDriverFromEntry(entry);
            if (profile) {
                map[profile.number] = profile;
            }
        });

        (data?.drivers ?? []).forEach(driver => {
            const profile = normalizeDriverFromApi(driver);
            if (profile) {
                map[profile.number] = profile;
            }
        });

        return map;
    }, [data?.drivers, driverEntries]);

    const renderHeader = () => (
        <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Overtakes</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{overtakes.length}</Text>
                    <Text style={styles.heroStatLabel}>Total Overtakes</Text>
                </View>
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{Object.keys(driverMap).length}</Text>
                    <Text style={styles.heroStatLabel}>Driver Profiles</Text>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading overtakes...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to load overtakes</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryHint} onPress={reload}>Tap to retry</Text>
            </View>
        );
    }

    if (!overtakes.length) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyTitle}>No Overtakes Recorded</Text>
                <Text style={styles.emptySubtitle}>
                    This race does not have any overtakes logged yet.
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={overtakes}
            keyExtractor={(item, index) =>
                `${item.sessionKey}-${item.overtakingDriverNumber}-${item.overtakenDriverNumber}-${index}`
            }
            renderItem={({ item }) => (
                <OvertakeCard
                    overtake={item}
                    overtakingDriver={driverMap[item.overtakingDriverNumber] ?? null}
                    overtakenDriver={driverMap[item.overtakenDriverNumber] ?? null}
                />
            )}
            contentContainerStyle={styles.container}
            ListHeaderComponent={renderHeader}
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

export default RaceOvertakesScreen;

const styles = StyleSheet.create({
    container: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
        backgroundColor: semanticColors.background,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        backgroundColor: semanticColors.background,
    },
    loadingText: {
        marginTop: spacing.sm,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.semibold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorText: {
        color: semanticColors.textMuted,
        textAlign: 'center',
    },
    retryHint: {
        marginTop: spacing.sm,
        color: semanticColors.danger,
        fontWeight: typography.weight.semibold,
    },
    emptyTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.semibold,
        color: semanticColors.surfaceInverse,
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        color: '#757575',
        textAlign: 'center',
    },
    heroCard: {
        backgroundColor: semanticColors.surfaceInverse,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    heroTitle: {
        color: semanticColors.surface,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xxs,
    },
    heroStats: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    heroStat: {
        marginRight: spacing.xl,
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.sm,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    card: {
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    cardSubtitle: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: semanticColors.surfaceMuted,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: semanticColors.surfaceMuted,
    },
    avatarFallbackText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    driverInfo: {
        width: 90,
        marginHorizontal: spacing.xs,
    },
    driverLabel: {
        fontSize: typography.size.xs,
        color: semanticColors.textMuted,
        textTransform: 'uppercase',
    },
    driverName: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginTop: 2,
    },
    driverTeam: {
        fontSize: typography.size.xs,
        color: semanticColors.textMuted,
        marginTop: 1,
    },
    chevronWrapper: {
        paddingHorizontal: spacing.xs,
    },
});
