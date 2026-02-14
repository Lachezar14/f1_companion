import React, { useCallback } from 'react';
import { semanticColors, spacing, typography } from '../../../theme/tokens';
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
                <ActivityIndicator size="large" color={semanticColors.danger} />
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
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={semanticColors.danger} />
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
        backgroundColor: semanticColors.backgroundMuted,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    header: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
    },
    overline: {
        fontSize: typography.size.sm,
        color: '#7C7F93',
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase',
    },
    title: {
        marginTop: spacing.xxs,
        fontSize: typography.size.xxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    subtitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.base,
        color: '#7C7F93',
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    message: {
        fontSize: typography.size.base,
        color: '#5F6272',
        textAlign: 'center',
    },
    hint: {
        marginTop: spacing.xs,
        fontSize: typography.size.sm,
        color: '#8A8FA6',
    },
    footerHint: {
        textAlign: 'center',
        paddingVertical: 18,
        color: '#9A9FB5',
        fontSize: typography.size.sm,
    },
});
