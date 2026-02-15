import React, { useCallback, useMemo, useState } from 'react';
import {
    colors,
    overlays,
    radius,
    semanticColors,
    shadows,
    spacing,
    typography,
} from '../../theme/tokens';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSeasonDrivers } from '../../../backend/service/openf1Service';
import type { Driver } from '../../../backend/types';
import { useServiceRequest } from '../../hooks/useServiceRequest';
import { AVAILABLE_MEETING_YEARS, DEFAULT_SEASON_YEAR } from '../../config/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const toCleanString = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const getDisplayName = (driver: Driver): string => {
    const fullName = toCleanString(driver.full_name);
    if (fullName) return fullName;

    const firstName = toCleanString(driver.first_name);
    const lastName = toCleanString(driver.last_name);
    const combined = `${firstName} ${lastName}`.trim();
    return combined || `Driver #${driver.driver_number}`;
};

const getDisplayTeam = (driver: Driver): string =>
    toCleanString(driver.team_name) || 'Team unavailable';

const getSortableLastName = (driver: Driver): string => {
    const lastName = toCleanString(driver.last_name);
    if (lastName) return lastName.toLowerCase();
    return getDisplayName(driver).toLowerCase();
};

const resolveTeamColor = (driver: Driver): string => {
    const raw = toCleanString(driver.team_colour);
    if (!raw) {
        return colors.brand.primary;
    }

    return raw.startsWith('#') ? raw : `#${raw}`;
};

const DriversScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const tabBarHeight = useBottomTabBarHeight();
    const [search, setSearch] = useState('');
    const [seasonYear, setSeasonYear] = useState(DEFAULT_SEASON_YEAR);

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<Driver[]>(() => getSeasonDrivers(seasonYear), [seasonYear]);

    const drivers = useMemo(() => {
        if (!data) {
            return [];
        }

        return Array.from(new Map(data.map(driver => [driver.driver_number, driver])).values()).sort(
            (a, b) => getSortableLastName(a).localeCompare(getSortableLastName(b))
        );
    }, [data]);

    const incompleteProfileCount = useMemo(
        () =>
            drivers.filter(driver => {
                const fullName = toCleanString(driver.full_name);
                const firstName = toCleanString(driver.first_name);
                const lastName = toCleanString(driver.last_name);
                const teamName = toCleanString(driver.team_name);
                const hasAnyName = Boolean(fullName || firstName || lastName);
                return !hasAnyName || !teamName;
            }).length,
        [drivers]
    );

    const teamCount = useMemo(() => {
        const teams = new Set<string>();
        drivers.forEach(driver => teams.add(getDisplayTeam(driver)));
        return teams.size;
    }, [drivers]);

    const filteredDrivers = useMemo(() => {
        if (!search.trim()) return drivers;
        const query = search.trim().toLowerCase();
        return drivers.filter(driver =>
            getDisplayName(driver).toLowerCase().includes(query) ||
            getDisplayTeam(driver).toLowerCase().includes(query)
        );
    }, [search, drivers]);

    const heroStats = useMemo(
        () => [
            { label: 'Drivers', value: drivers.length || '—' },
            { label: 'Teams', value: teamCount || '—' },
            { label: 'Matches', value: filteredDrivers.length || '—' },
        ],
        [drivers.length, teamCount, filteredDrivers.length]
    );

    const handleDriverPress = useCallback(
        (driver: Driver) => {
            navigation.navigate('DriverSeasonDetails', {
                driverNumber: driver.driver_number,
                year: seasonYear,
                driverName: getDisplayName(driver),
                teamName: getDisplayTeam(driver),
                teamColor: driver.team_colour,
                headshotUrl: driver.headshot_url,
            });
        },
        [navigation, seasonYear]
    );

    const getDriverCode = (driver: Driver) => {
        const acronym = toCleanString(driver.name_acronym);
        if (acronym) return acronym.toUpperCase();

        const cleanedLastName = toCleanString(driver.last_name).replace(/[^A-Za-z]/g, '');
        if (cleanedLastName) return cleanedLastName.slice(0, 3).toUpperCase();

        const cleanedDisplayName = getDisplayName(driver).replace(/[^A-Za-z]/g, '');
        if (cleanedDisplayName) return cleanedDisplayName.slice(0, 3).toUpperCase();
        return `#${driver.driver_number}`;
    };

    const renderScreenHeader = () => (
        <View style={styles.screenHeader}>
            <Text style={styles.screenLabel}>SEASON HUB</Text>
            <Text style={styles.screenTitle}>Drivers</Text>
        </View>
    );

    const renderListHeader = () => (
        <>
            <View style={styles.heroCard}>
                <View style={styles.heroRail} />
                <View style={styles.heroTopRow}>
                    <Text style={styles.heroEyebrow}>PADDOCK</Text>
                    <View style={styles.seasonBadge}>
                        <Ionicons name="flag-outline" size={12} color={semanticColors.surface} />
                        <Text style={styles.seasonBadgeText}>SEASON {seasonYear}</Text>
                    </View>
                </View>

                <Text style={styles.heroTitle}>Driver Grid</Text>
                <Text style={styles.heroDescription}>
                    Search drivers by name or team and open their season details.
                </Text>

                <View style={styles.yearRow}>
                    {AVAILABLE_MEETING_YEARS.map(year => (
                        <TouchableOpacity
                            key={year}
                            activeOpacity={0.85}
                            onPress={() => setSeasonYear(year)}
                            style={[
                                styles.yearChip,
                                seasonYear === year && styles.yearChipActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.yearChipText,
                                    seasonYear === year && styles.yearChipTextActive,
                                ]}
                            >
                                {year}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.heroStatRow}>
                    {heroStats.map((stat, index) => (
                        <React.Fragment key={stat.label}>
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatValue}>{stat.value}</Text>
                                <Text style={styles.heroStatLabel}>{stat.label}</Text>
                            </View>
                            {index < heroStats.length - 1 ? <View style={styles.heroDivider} /> : null}
                        </React.Fragment>
                    ))}
                </View>
            </View>

            <View style={styles.searchCard}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.72)" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search drivers or teams"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {incompleteProfileCount > 0 ? (
                <View style={styles.warningCard}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F4C53F" />
                    <Text style={styles.warningText}>
                        {incompleteProfileCount} profile{incompleteProfileCount > 1 ? 's are' : ' is'} missing some data.
                    </Text>
                </View>
            ) : null}

            <View style={styles.listSectionHeader}>
                <Text style={styles.listSectionTitle}>Driver Line-Up</Text>
                <View style={styles.listSectionCount}>
                    <Text style={styles.listSectionCountText}>{filteredDrivers.length}</Text>
                </View>
            </View>
        </>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={semanticColors.danger} />
                    <Text style={styles.loadingText}>Loading drivers…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <Text style={styles.errorTitle}>Unable to load drivers</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={reload}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const renderDriver = ({ item }: { item: Driver }) => {
        const teamColor = resolveTeamColor(item);
        const displayName = getDisplayName(item);
        const displayTeam = getDisplayTeam(item);
        const avatarInitial = (toCleanString(item.last_name)[0] || displayName[0] || '?').toUpperCase();

        return (
            <TouchableOpacity
                style={styles.driverCard}
                activeOpacity={0.86}
                onPress={() => handleDriverPress(item)}
            >
                <View style={[styles.driverStripe, { backgroundColor: teamColor }]} />

                {item.headshot_url ? (
                    <Image source={{ uri: item.headshot_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                    </View>
                )}

                <View style={styles.driverInfo}>
                    <View style={styles.driverTopRow}>
                        <Text style={styles.driverName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <View style={[styles.numberBadge, { borderColor: teamColor }]}> 
                            <Text style={styles.numberText}>#{item.driver_number}</Text>
                        </View>
                    </View>

                    <View style={styles.driverBottomRow}>
                        <View style={styles.driverCodeChip}>
                            <Text style={styles.driverCodeText}>{getDriverCode(item)}</Text>
                        </View>
                        <View style={styles.teamChip}>
                            <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.78)" />
                            <Text style={styles.teamChipText} numberOfLines={1}>{displayTeam}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderScreenHeader()}
            <FlatList
                data={filteredDrivers}
                keyExtractor={driver => driver.driver_number.toString()}
                renderItem={renderDriver}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: tabBarHeight + 24 },
                ]}
                ListHeaderComponent={renderListHeader}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={semanticColors.danger}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyStateCard}>
                        <Text style={styles.emptyStateTitle}>No drivers found</Text>
                        <Text style={styles.emptyStateSubtitle}>Try a different name or team.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

export default DriversScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.backgroundMuted,
    },
    screenHeader: {
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
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.backgroundMuted,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        color: semanticColors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: semanticColors.danger,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
        ...shadows.glow,
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    heroCard: {
        backgroundColor: colors.neutral.carbon,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
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
        width: 84,
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
    seasonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
    },
    seasonBadgeText: {
        color: semanticColors.surface,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
        marginLeft: 5,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.black,
        color: semanticColors.surface,
        letterSpacing: typography.letterSpacing.tight,
    },
    heroDescription: {
        color: 'rgba(255,255,255,0.75)',
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wide,
    },
    yearRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    yearChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white08,
        borderWidth: 1,
        borderColor: overlays.white12,
        marginHorizontal: spacing.xxs,
        marginBottom: spacing.xs,
    },
    yearChipActive: {
        backgroundColor: semanticColors.danger,
        borderColor: semanticColors.danger,
    },
    yearChipText: {
        color: 'rgba(255,255,255,0.78)',
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wider,
    },
    yearChipTextActive: {
        color: semanticColors.surface,
    },
    heroStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        backgroundColor: overlays.white10,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        paddingVertical: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.66)',
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginTop: spacing.xxs,
    },
    heroDivider: {
        width: 1,
        height: 30,
        backgroundColor: overlays.white20,
    },
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: overlays.white12,
        marginBottom: spacing.sm,
        ...shadows.level2,
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.size.base,
        color: semanticColors.surface,
    },
    warningCard: {
        marginBottom: spacing.sm,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: '#866600',
        backgroundColor: '#33270A',
        flexDirection: 'row',
        alignItems: 'center',
    },
    warningText: {
        flex: 1,
        marginLeft: spacing.xs,
        color: '#FFD468',
        fontSize: typography.size.sm,
        lineHeight: 16,
    },
    listSectionHeader: {
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
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
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: overlays.white12,
        overflow: 'hidden',
        minHeight: 92,
        ...shadows.level2,
    },
    driverStripe: {
        width: 4,
        alignSelf: 'stretch',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        marginLeft: spacing.sm,
        backgroundColor: '#313444',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        marginLeft: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#313444',
    },
    avatarInitial: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    driverInfo: {
        flex: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
    },
    driverTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    driverName: {
        flex: 1,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginRight: spacing.xs,
    },
    numberBadge: {
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 5,
        minWidth: 52,
        alignItems: 'center',
    },
    numberText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.xs,
        letterSpacing: typography.letterSpacing.wide,
    },
    driverBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverCodeChip: {
        backgroundColor: overlays.white10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        marginRight: spacing.xs,
    },
    driverCodeText: {
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wider,
    },
    teamChip: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        backgroundColor: overlays.white10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        marginRight: spacing.xs,
    },
    teamChipText: {
        marginLeft: 5,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.88)',
        fontWeight: typography.weight.medium,
        flex: 1,
    },
    emptyStateCard: {
        marginTop: spacing.xl,
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: semanticColors.border,
        backgroundColor: semanticColors.surface,
    },
    emptyStateTitle: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptyStateSubtitle: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
});
