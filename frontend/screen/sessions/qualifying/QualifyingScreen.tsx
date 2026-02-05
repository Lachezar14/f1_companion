import React, { useCallback } from 'react';
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
import { getQualifyingSessionDetail } from '../../../../backend/service/openf1Service';
import type { QualifyingDriverClassification, QualifyingSessionDetail } from '../../../../backend/types';
import QualifyingResultsSection from '../../../component/qualifying/QualifyingResultCard';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};
type NavigationProp = NativeStackNavigationProp<any>;

const QualifyingScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const navigation = useNavigation<NavigationProp>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadClassification = useCallback(
        () => getQualifyingSessionDetail(sessionKey),
        [sessionKey]
    );

    const {
        data,
        loading,
        error,
        refreshing,
        reload,
        refresh,
    } = useServiceRequest<QualifyingSessionDetail>(loadClassification, [loadClassification]);

    const rows = data?.classification ?? [];

    const handleDriverPress = useCallback(
        (driverNumber: number) => {
            navigation.navigate('DriverOverview', {
                driverNumber,
                sessionKey,
            });
        },
        [navigation, sessionKey]
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading qualifying data...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
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
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor="#E10600"
                />
            }
        >
            <View style={styles.heroCard}>
                <View>
                    <Text style={styles.heroSubtitle}>{meetingName}</Text>
                    <Text style={styles.heroTitle}>{sessionName}</Text>
                    {data?.date_start && (
                        <Text style={styles.heroDate}>
                            {new Date(data.date_start).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </Text>
                    )}
                </View>
                <View style={styles.heroChipRow}>
                    {data?.circuit_short_name ? (
                        <View style={styles.heroChip}>
                            <Text style={styles.heroChipText}>{data.circuit_short_name}</Text>
                        </View>
                    ) : null}
                    <View style={styles.heroChip}>
                        <Text style={styles.heroChipText}>{rows.length} Drivers</Text>
                    </View>
                </View>
            </View>

            <QualifyingResultsSection rows={rows} onDriverPress={handleDriverPress} />

            <Text style={styles.refreshHint}>Pull down to refresh</Text>
        </ScrollView>
    );
};

export default QualifyingScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
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
    heroCard: {
        backgroundColor: '#15151E',
        margin: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 6,
    },
    heroDate: {
        color: 'rgba(255,255,255,0.72)',
        marginTop: 6,
    },
    heroChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 14,
        marginHorizontal: -4,
    },
    heroChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginHorizontal: 4,
        marginBottom: 6,
    },
    heroChipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    refreshHint: {
        paddingVertical: 28,
        textAlign: 'center',
        color: '#9A9A9A',
    },
});
