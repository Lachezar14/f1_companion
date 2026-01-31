import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRaceClassification } from '../../backend/service/openf1Service';
import type { RaceDriverClassification } from '../../backend/types';
import RaceResultCard from '../component/session/RaceResultCard';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

interface RaceState {
    rows: RaceDriverClassification[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

type NavigationProp = NativeStackNavigationProp<any>;

const RaceScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const [state, setState] = useState<RaceState>({
        rows: [],
        loading: true,
        refreshing: false,
        error: null,
    });

    const loadClassification = useCallback(
        async (isRefresh = false) => {
            setState(prev => ({
                ...prev,
                loading: !isRefresh,
                refreshing: isRefresh,
                error: null,
            }));

            try {
                const data = await getRaceClassification(sessionKey);
                if (!data) {
                    setState({
                        rows: [],
                        loading: false,
                        refreshing: false,
                        error: 'Failed to load race session data',
                    });
                    return;
                }

                setState({
                    rows: data,
                    loading: false,
                    refreshing: false,
                    error: null,
                });
            } catch (error) {
                setState({
                    rows: [],
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load race session data',
                });
            }
        },
        [sessionKey]
    );

    useEffect(() => {
        loadClassification();
    }, [loadClassification]);

    const handleRefresh = useCallback(() => loadClassification(true), [loadClassification]);
    const handleRetry = useCallback(() => loadClassification(false), [loadClassification]);

    const handleDriverPress = useCallback(
        (driverNumber: number) => {
            navigation.navigate('DriverOverview', {
                driverNumber,
                sessionKey,
            });
        },
        [navigation, sessionKey]
    );

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading race data...</Text>
            </View>
        );
    }

    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
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
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#E10600"
                />
            }
        >
            <View style={styles.header}>
                <Text style={styles.title}>{sessionName}</Text>
                {meetingName && <Text style={styles.meetingName}>{meetingName}</Text>}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏁 Race Classification</Text>
                {state.rows.length === 0 ? (
                    <Text style={styles.noData}>No classification available</Text>
                ) : (
                    state.rows.map(row => (
                        <RaceResultCard
                            key={row.driverNumber}
                            data={row}
                            onPress={handleDriverPress}
                        />
                    ))
                )}
            </View>

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default RaceScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F2',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2F2F2',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 16,
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
    header: {
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15151E',
    },
    meetingName: {
        marginTop: 4,
        color: '#666',
    },
    section: {
        marginTop: 12,
        backgroundColor: '#FFF',
        padding: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 12,
    },
    noData: {
        textAlign: 'center',
        color: '#999',
    },
    refreshHint: {
        paddingVertical: 24,
        textAlign: 'center',
        color: '#AAA',
    },
});
