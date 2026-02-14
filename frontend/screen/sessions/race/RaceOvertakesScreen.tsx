import React, { useMemo, useState, useEffect } from 'react';
import { colors, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDriversByOvertake } from '../../../../backend/service/openf1Service';
import type { Driver, Overtake, SessionDriverData } from '../../../../backend/types';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
    overtakes: Overtake[];
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

    const initials = profile.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

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

const buildDriverMapFromEntries = (entries: SessionDriverData[]): Record<number, DriverProfile> => {
    return entries.reduce<Record<number, DriverProfile>>((acc, entry) => {
        const profile = normalizeDriverFromEntry(entry);
        if (profile) {
            acc[entry.driverNumber] = profile;
        }
        return acc;
    }, {});
};

const RaceOvertakesScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName, overtakes, driverEntries = [] } = route.params;

    const baseDriverMap = useMemo(
        () => buildDriverMapFromEntries(driverEntries ?? []),
        [driverEntries]
    );
    const [driverMap, setDriverMap] = useState<Record<number, DriverProfile>>(baseDriverMap);
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    useEffect(() => {
        setDriverMap(baseDriverMap);
    }, [baseDriverMap]);

    useEffect(() => {
        if (!overtakes.length) return;

        const uniquePairs = Array.from(
            new Map(
                overtakes.map(overtake => {
                    const key = `${overtake.overtakingDriverNumber}-${overtake.overtakenDriverNumber}`;
                    return [
                        key,
                        [overtake.overtakingDriverNumber, overtake.overtakenDriverNumber] as [number, number],
                    ];
                })
            ).values()
        );

        let cancelled = false;
        setLoadingDrivers(true);

        (async () => {
            try {
                const results = await Promise.all(
                    uniquePairs.map(pair =>
                        getDriversByOvertake({
                            sessionKey,
                            driverNumber: pair,
                        })
                    )
                );

                if (cancelled) return;

                setDriverMap(prev => {
                    const next = { ...prev };
                    results.forEach(result => {
                        const overtakingProfile = normalizeDriverFromApi(result.overtakingDriver);
                        const overtakenProfile = normalizeDriverFromApi(result.overtakenDriver);
                        if (overtakingProfile) {
                            next[overtakingProfile.number] = overtakingProfile;
                        }
                        if (overtakenProfile) {
                            next[overtakenProfile.number] = overtakenProfile;
                        }
                    });
                    return next;
                });
            } catch (error) {
                console.warn('[Overtakes] Failed to load driver profiles', error);
            } finally {
                if (!cancelled) {
                    setLoadingDrivers(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [overtakes, sessionKey]);

    const heroSubtitle = meetingName ? `${meetingName} · ${sessionName}` : sessionName;

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
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>Overtakes</Text>
                <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
                <View style={styles.heroStats}>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{overtakes.length}</Text>
                        <Text style={styles.heroStatLabel}>Total Overtakes</Text>
                    </View>
                    <View style={styles.heroStat}>
                        <Text style={styles.heroStatValue}>{loadingDrivers ? '...' : 'Ready'}</Text>
                        <Text style={styles.heroStatLabel}>Driver Data</Text>
                    </View>
                </View>
            </View>

            {loadingDrivers && (
                <View style={styles.loadingRow}>
                    <ActivityIndicator color={semanticColors.danger} />
                    <Text style={styles.loadingText}>Enriching driver profiles...</Text>
                </View>
            )}

            <FlatList
                data={overtakes}
                keyExtractor={(item, index) =>
                    `${item.sessionKey}-${item.overtakingDriverNumber}-${item.overtakenDriverNumber}-${index}`
                }
                renderItem={({ item }) => (
                    <OvertakeCard
                        overtake={item}
                        overtakingDriver={
                            driverMap[item.overtakingDriverNumber] ?? null
                        }
                        overtakenDriver={
                            driverMap[item.overtakenDriverNumber] ?? null
                        }
                    />
                )}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
            />
        </ScrollView>
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
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    loadingText: {
        marginLeft: spacing.xs,
        color: '#757575',
    },
    listContent: {
        paddingBottom: spacing.md,
    },
    card: {
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.surfaceInverse,
    },
    cardSubtitle: {
        color: '#757575',
        fontSize: typography.size.sm,
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: radius.xxl,
        backgroundColor: semanticColors.border,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECECEC',
    },
    avatarFallbackText: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surfaceInverse,
    },
    driverInfo: {
        flex: 1,
        marginHorizontal: spacing.xs,
    },
    driverLabel: {
        fontSize: typography.size.sm,
        color: semanticColors.success,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    driverName: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.surfaceInverse,
    },
    driverTeam: {
        fontSize: typography.size.sm,
        color: '#757575',
    },
    chevronWrapper: {
        paddingHorizontal: spacing.xxs,
    },
});
