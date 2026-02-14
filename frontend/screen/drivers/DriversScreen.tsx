import React, { useCallback, useMemo, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../theme/tokens';
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

    const heroStats = useMemo(
        () => [
            { label: 'Drivers', value: drivers.length || '—' },
            { label: 'Teams', value: teamCount || '—' },
            { label: 'Season', value: seasonYear },
        ],
        [drivers.length, teamCount, seasonYear]
    );

    const filteredDrivers = useMemo(() => {
        if (!search.trim()) return drivers;
        const query = search.trim().toLowerCase();
        return drivers.filter(driver =>
            getDisplayName(driver).toLowerCase().includes(query) ||
            getDisplayTeam(driver).toLowerCase().includes(query)
        );
    }, [search, drivers]);

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

    const renderListHeader = () => (
        <>
            <View style={styles.heroCard}>
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
                <Text style={styles.heroSubtitle}>Season {seasonYear}</Text>
                <Text style={styles.heroTitle}>Driver Line-Up</Text>
                <Text style={styles.heroDescription}>
                    Browse all registered drivers and jump into their season form.
                </Text>
                <View style={styles.heroStatRow}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <View style={styles.searchCard}>
                <Ionicons name="search" size={18} color={semanticColors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search drivers or teams"
                    placeholderTextColor={semanticColors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>
            {incompleteProfileCount > 0 ? (
                <View style={styles.warningCard}>
                    <Ionicons name="alert-circle-outline" size={16} color={semanticColors.warning} />
                    <Text style={styles.warningText}>
                        {incompleteProfileCount} driver profile
                        {incompleteProfileCount > 1 ? 's are' : ' is'} missing data. Placeholder
                        values are shown.
                    </Text>
                </View>
            ) : null}
        </>
    );

    const renderScreenHeader = () => (
        <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Drivers</Text>
        </View>
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
                    <Text style={styles.errorTitle}>Unable to Load Drivers</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={reload}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const renderDriver = ({ item }: { item: Driver }) => {
        const teamColor = item.team_colour ? `#${item.team_colour}` : semanticColors.textPrimary;
        const displayName = getDisplayName(item);
        const displayTeam = getDisplayTeam(item);
        const avatarInitial =
            toCleanString(item.last_name)[0] || displayName[0] || '?';
        return (
            <TouchableOpacity
                style={styles.driverCard}
                activeOpacity={0.8}
                onPress={() => handleDriverPress(item)}
            >
                <View style={[styles.numberPill, { backgroundColor: teamColor }]}>
                    <Text style={styles.numberText}>#{item.driver_number}</Text>
                </View>
                <View style={styles.profileBlock}>
                    {item.headshot_url ? (
                        <Image source={{ uri: item.headshot_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                        </View>
                    )}
                    <View style={styles.driverInfo}>
                        <Text style={styles.driverCode}>{getDriverCode(item)}</Text>
                        <Text style={styles.driverName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <View style={styles.teamChip}>
                            <Text style={styles.teamChipText}>{displayTeam}</Text>
                        </View>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C5C5C5" />
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
                    <Text style={styles.emptyState}>No drivers match your search.</Text>
                }
            />
        </SafeAreaView>
    );
};

export default DriversScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    screenHeader: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xxs,
    },
    screenTitle: {
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
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
        marginTop: spacing.sm,
        color: semanticColors.textMuted,
    },
    errorTitle: {
        fontSize: typography.size.xl,
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
    },
    retryButtonText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
    heroCard: {
        backgroundColor: semanticColors.textPrimary,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    yearRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
        marginBottom: spacing.sm,
    },
    yearChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white12,
        marginHorizontal: spacing.xxs,
        marginBottom: spacing.xs,
    },
    yearChipActive: {
        backgroundColor: semanticColors.surface,
    },
    yearChipText: {
        color: 'rgba(255,255,255,0.75)',
        fontWeight: typography.weight.semibold,
    },
    yearChipTextActive: {
        color: semanticColors.textPrimary,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        fontSize: typography.size.sm,
        letterSpacing: 1.2,
    },
    heroTitle: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginTop: spacing.xs,
    },
    heroDescription: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xs,
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: 18,
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
        color: 'rgba(255,255,255,0.6)',
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginTop: spacing.xxs,
    },
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: semanticColors.border,
        marginBottom: spacing.sm,
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.size.lg,
        color: semanticColors.textPrimary,
    },
    warningCard: {
        marginBottom: spacing.sm,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: '#F4D58D',
        backgroundColor: '#FFF8E1',
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    warningText: {
        flex: 1,
        marginLeft: spacing.xs,
        color: '#6A4E00',
        fontSize: typography.size.sm,
        lineHeight: 16,
    },
    listContent: {
        paddingHorizontal: spacing.md,
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: semanticColors.border,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    numberPill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        marginRight: spacing.sm,
    },
    numberText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
    },
    profileBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: spacing.sm,
        backgroundColor: semanticColors.border,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: semanticColors.border,
    },
    avatarInitial: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: '#555',
    },
    driverInfo: {
        flex: 1,
    },
    driverCode: {
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wider,
        color: '#9A9A9A',
        textTransform: 'uppercase',
    },
    driverName: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        marginTop: 2,
    },
    teamChip: {
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.md,
        backgroundColor: semanticColors.backgroundMuted,
    },
    teamChipText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        color: '#4C4C4C',
    },
    emptyState: {
        textAlign: 'center',
        color: semanticColors.textMuted,
        marginTop: spacing.xl,
    },
});
