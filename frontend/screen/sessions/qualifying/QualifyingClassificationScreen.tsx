import React, { useCallback, useMemo } from 'react';
import { semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
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

const QualifyingClassificationScreen = () => {
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
        refresh,
        refreshing,
    } = useServiceRequest<QualifyingSessionDetail>(loadClassification, [loadClassification]);

    const rows = data?.classification ?? [];
    const driverEntries = data?.drivers ?? [];
    const driverEntryMap = useMemo(
        () => new Map(driverEntries.map(entry => [entry.driverNumber, entry])),
        [driverEntries]
    );
    const driverOptions = useMemo(
        () =>
            rows.map(row => {
                const entry = driverEntryMap.get(row.driverNumber);
                return {
                    driverNumber: row.driverNumber,
                    name: row.driverName,
                    team: row.teamName,
                    teamColor: entry?.driver.teamColor ?? row.teamColor ?? null,
                };
            }),
        [driverEntryMap, rows]
    );

    const handleDriverPress = useCallback(
        (driverNumber: number) => {
            navigation.navigate('DriverQualifyingOverview', {
                driverNumber,
                sessionKey,
                sessionName,
                meetingName,
                driverData: driverEntryMap.get(driverNumber) ?? null,
                driverOptions,
            });
        },
        [driverEntryMap, driverOptions, meetingName, navigation, sessionKey, sessionName]
    );

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
                <Text style={styles.message}>{error || 'No qualifying detail found'}</Text>
                <Text style={styles.hint}>Pull to refresh or try again.</Text>
            </View>
        );
    }

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
                    Qualifying classification • {rows.length} {rows.length === 1 ? 'driver' : 'drivers'}
                </Text>
            </View>
            <QualifyingResultsSection rows={rows} onDriverPress={handleDriverPress} />
            <Text style={styles.footerHint}>Pull down to refresh classification</Text>
        </ScrollView>
    );
};

export default QualifyingClassificationScreen;

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
        color: '#8A9AB6',
    },
    footerHint: {
        textAlign: 'center',
        paddingVertical: 18,
        color: '#9A9FB5',
        fontSize: typography.size.sm,
    },
});
