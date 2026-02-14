import React, { useMemo, useState } from 'react';
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
import { AVAILABLE_MEETING_YEARS, DEFAULT_MEETING_YEAR } from '../config/appConfig';
import { useServiceRequest } from '../hooks/useServiceRequest';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const SessionsScreen = () => {
    const [seasonYear, setSeasonYear] = useState(DEFAULT_MEETING_YEAR);
    const tabBarHeight = useBottomTabBarHeight();
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
            <View style={styles.yearRow}>
                {AVAILABLE_MEETING_YEARS.map(year => (
                    <TouchableOpacity
                        key={year}
                        onPress={() => setSeasonYear(year)}
                        activeOpacity={0.85}
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

    const renderScreenHeader = () => (
        <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Races</Text>
        </View>
    );

    const renderMeeting = ({ item }: { item: Meeting }) => <GPCard meeting={item} />;

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#E10600" />
                    <Text style={styles.loadingText}>Loading calendar…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderScreenHeader()}
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={reload}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderScreenHeader()}
            <FlatList
                data={meetings}
                keyExtractor={item => item.meeting_key.toString()}
                renderItem={renderMeeting}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: tabBarHeight + 28 },
                ]}
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
    screenHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    screenTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#15151E',
    },
    listContent: {
        padding: 16,
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
    yearRow: {
        flexDirection: 'row',
        marginBottom: 12,
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    yearChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginHorizontal: 4,
        marginBottom: 8,
    },
    yearChipActive: {
        backgroundColor: '#FFF',
    },
    yearChipText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    yearChipTextActive: {
        color: '#15151E',
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
