import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getRaceSessionDetail } from '../../../../backend/service/openf1Service';
import type { RaceSessionDetail } from '../../../../backend/types';
import RaceResultsSection from '../../../component/race/RaceResultCard';
import { useServiceRequest } from '../../../hooks/useServiceRequest';

type RouteParams = {
    sessionKey: number;
    sessionName: string;
    meetingName?: string;
};

const RaceClassificationScreen = () => {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { sessionKey, sessionName, meetingName } = route.params;

    const loadRaceData = useCallback(async (): Promise<RaceSessionDetail> => {
        return getRaceSessionDetail(sessionKey);
    }, [sessionKey]);

    const {
        data,
        loading,
        error,
        refresh,
        refreshing,
    } = useServiceRequest<RaceSessionDetail>(loadRaceData, [loadRaceData]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.message}>Loading classification...</Text>
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load</Text>
                <Text style={styles.message}>{error || 'No race detail found'}</Text>
                <Text style={styles.hint}>Pull to refresh or try again.</Text>
            </View>
        );
    }

    const rows = data.classification ?? [];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E10600" />
            }
        >
            <View style={styles.header}>
                <Text style={styles.overline}>{meetingName || data.location}</Text>
                <Text style={styles.title}>{sessionName}</Text>
                <Text style={styles.subtitle}>
                    Race classification • {rows.length} {rows.length === 1 ? 'driver' : 'drivers'}
                </Text>
            </View>
            <RaceResultsSection rows={rows} />
            <Text style={styles.footerHint}>Pull down to refresh classification</Text>
        </ScrollView>
    );
};

export default RaceClassificationScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F6F8',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    overline: {
        fontSize: 12,
        color: '#7C7F93',
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    title: {
        marginTop: 4,
        fontSize: 24,
        fontWeight: '700',
        color: '#15151E',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#7C7F93',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E10600',
        marginBottom: 6,
    },
    message: {
        fontSize: 14,
        color: '#5F6272',
        textAlign: 'center',
    },
    hint: {
        marginTop: 6,
        fontSize: 12,
        color: '#8A8FA6',
    },
    footerHint: {
        textAlign: 'center',
        paddingVertical: 18,
        color: '#9A9FB5',
        fontSize: 12,
    },
});
