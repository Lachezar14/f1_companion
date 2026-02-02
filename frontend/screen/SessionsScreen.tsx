import React, { useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { getMeetingsByYear } from '../../backend/service/openf1Service';
import type { Meeting } from '../../backend/types';
import GPCard from '../component/gp/GPCard';
import { DEFAULT_MEETING_YEAR } from '../config/appConfig';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { SafeAreaView } from 'react-native-safe-area-context';

const SessionsScreen = () => {
    const seasonYear = DEFAULT_MEETING_YEAR;
    const { data, loading, error, reload } = useServiceRequest<Meeting[]>(
        () => getMeetingsByYear(seasonYear),
        [seasonYear]
    );

    const meetings = data ?? [];

    const seasonSummary = useMemo(() => {
        const upcoming = meetings.filter(
            meeting => new Date(meeting.date_start).getTime() > Date.now()
        ).length;
        return {
            total: meetings.length,
            upcoming,
        };
    }, [meetings]);

    const renderHero = () => (
        <View style={styles.heroCard}>
            <View>
                <Text style={styles.heroSubtitle}>Formula 1 · Season {seasonYear}</Text>
                <Text style={styles.heroTitle}>Grand Prix Calendar</Text>
            </View>
            <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{seasonSummary.total}</Text>
                    <Text style={styles.heroStatLabel}>Events</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{seasonSummary.upcoming}</Text>
                    <Text style={styles.heroStatLabel}>Upcoming</Text>
                </View>
            </View>
        </View>
    );

    const renderMeeting = ({ item }: { item: Meeting }) => <GPCard meeting={item} />;

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E10600" />
                <Text style={styles.loadingText}>Loading calendar…</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={meetings}
                keyExtractor={item => item.meeting_key.toString()}
                renderItem={renderMeeting}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={renderHero}
            />
        </SafeAreaView>
    );
};

export default SessionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F7',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#333',
    },
    errorText: {
        fontSize: 16,
        color: '#FF3B30',
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#E10600',
        borderRadius: 8,
    },
    retryText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    heroCard: {
        backgroundColor: '#15151E',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        paddingVertical: 12,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFF',
    },
    heroStatLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: 1,
        marginTop: 4,
    },
    heroDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
});
