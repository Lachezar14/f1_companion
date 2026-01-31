import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getSeasonDrivers } from '../../backend/service/openf1Service';
import type { Driver } from '../../backend/types';

const SEASON_YEAR = 2025;

interface DriverListState {
    drivers: Driver[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const DriversScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [search, setSearch] = useState('');
    const [state, setState] = useState<DriverListState>({
        drivers: [],
        loading: true,
        refreshing: false,
        error: null,
    });

    const loadDrivers = useCallback(
        async (refresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !refresh,
                refreshing: refresh,
                error: null,
            }));

            try {
                const drivers = await getSeasonDrivers(SEASON_YEAR);
                const uniqueDrivers = Array.from(
                    new Map(drivers.map(driver => [driver.driver_number, driver])).values()
                ).sort((a, b) => a.last_name.localeCompare(b.last_name));

                setState({
                    drivers: uniqueDrivers,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load drivers',
                }));
            }
        },
        []
    );

    useEffect(() => {
        loadDrivers();
    }, [loadDrivers]);

    const filteredDrivers = useMemo(() => {
        if (!search.trim()) return state.drivers;
        const query = search.trim().toLowerCase();
        return state.drivers.filter(driver =>
            driver.full_name.toLowerCase().includes(query) ||
            driver.team_name.toLowerCase().includes(query)
        );
    }, [search, state.drivers]);

    const handleDriverPress = useCallback(
        (driver: Driver) => {
            navigation.navigate('DriverSeasonDetails', {
                driverNumber: driver.driver_number,
                year: SEASON_YEAR,
                driverName: driver.full_name,
                teamName: driver.team_name,
                teamColor: driver.team_colour,
                headshotUrl: driver.headshot_url,
            });
        },
        [navigation]
    );

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading drivers…</Text>
            </View>
        );
    }

    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Drivers</Text>
                <Text style={styles.errorMessage}>{state.error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadDrivers(false)}>
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
                <View style={[styles.teamAccent, { backgroundColor: teamColor }]} />
                {item.headshot_url ? (
                    <Image source={{ uri: item.headshot_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{item.last_name[0]}</Text>
                    </View>
                )}
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{item.full_name}</Text>
                    <Text style={styles.driverMeta}>#{item.driver_number} · {item.team_name}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search drivers or teams"
                    placeholderTextColor="#999"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filteredDrivers}
                keyExtractor={driver => driver.driver_number.toString()}
                renderItem={renderDriver}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={state.refreshing}
                        onRefresh={() => loadDrivers(true)}
                        tintColor="#E10600"
                    />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyState}>No drivers match your search.</Text>
                }
            />
        </View>
    );
};

export default DriversScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F2',
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
    searchContainer: {
        padding: 16,
        backgroundColor: '#FFF',
    },
    searchInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: '#15151E',
    },
    listContent: {
        padding: 16,
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    teamAccent: {
        width: 4,
        backgroundColor: '#15151E',
        alignSelf: 'stretch',
        borderRadius: 2,
        marginRight: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DDD',
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#555',
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
    },
    driverMeta: {
        marginTop: 4,
        color: '#666',
    },
    emptyState: {
        textAlign: 'center',
        color: '#999',
        marginTop: 24,
    },
});
