import React, { useCallback, useMemo, useState } from 'react';
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
import { DEFAULT_SEASON_YEAR } from '../../config/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const DriversScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [search, setSearch] = useState('');
    const seasonYear = DEFAULT_SEASON_YEAR;

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
            (a, b) => a.last_name.localeCompare(b.last_name)
        );
    }, [data]);

    const teamCount = useMemo(() => {
        const teams = new Set<string>();
        drivers.forEach(driver => teams.add(driver.team_name));
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
            driver.full_name.toLowerCase().includes(query) ||
            driver.team_name.toLowerCase().includes(query)
        );
    }, [search, drivers]);

    const handleDriverPress = useCallback(
        (driver: Driver) => {
            navigation.navigate('DriverSeasonDetails', {
                driverNumber: driver.driver_number,
                year: seasonYear,
                driverName: driver.full_name,
                teamName: driver.team_name,
                teamColor: driver.team_colour,
                headshotUrl: driver.headshot_url,
            });
        },
        [navigation, seasonYear]
    );

    const getDriverCode = (driver: Driver) => {
        const acronym = driver.name_acronym?.trim();
        if (acronym) return acronym.toUpperCase();
        const cleaned = driver.last_name.replace(/[^A-Za-z]/g, '');
        return cleaned.slice(0, 3).toUpperCase();
    };

    const renderListHeader = () => (
        <>
            <View style={styles.heroCard}>
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
                <Ionicons name="search" size={18} color="#9B9B9B" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search drivers or teams"
                    placeholderTextColor="#999"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>
        </>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading drivers…</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Drivers</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderDriver = ({ item }: { item: Driver }) => {
        const teamColor = item.team_colour ? `#${item.team_colour}` : '#15151E';
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
                            <Text style={styles.avatarInitial}>{item.last_name[0]}</Text>
                        </View>
                    )}
                    <View style={styles.driverInfo}>
                        <Text style={styles.driverCode}>{getDriverCode(item)}</Text>
                        <Text style={styles.driverName} numberOfLines={1}>
                            {item.full_name}
                        </Text>
                        <View style={styles.teamChip}>
                            <Text style={styles.teamChipText}>{item.team_name}</Text>
                        </View>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C5C5C5" />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={filteredDrivers}
                keyExtractor={driver => driver.driver_number.toString()}
                renderItem={renderDriver}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={renderListHeader}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#E10600"
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
        backgroundColor: '#F5F5F7',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F2F2F2',
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
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
        backgroundColor: '#15151E',
        marginTop: 16,
        marginBottom: 12,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 1.2,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 6,
    },
    heroDescription: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: 18,
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
        fontSize: 18,
        fontWeight: '700',
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 4,
    },
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E6E6E6',
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#15151E',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E6E6E6',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    numberPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 12,
    },
    numberText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 12,
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
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E2E2',
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '700',
        color: '#555',
    },
    driverInfo: {
        flex: 1,
    },
    driverCode: {
        fontSize: 13,
        letterSpacing: 1,
        color: '#9A9A9A',
        textTransform: 'uppercase',
    },
    driverName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
        marginTop: 2,
    },
    teamChip: {
        marginTop: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
    },
    teamChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4C4C4C',
    },
    emptyState: {
        textAlign: 'center',
        color: '#999',
        marginTop: 24,
    },
});
