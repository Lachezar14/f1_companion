import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Session } from '../../../backend/types';

interface SessionCardProps {
    session: Session;
    meetingName?: string;
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function SessionCard({ session, meetingName }: SessionCardProps) {
    const navigation = useNavigation<NavigationProp>();

    /**
     * Get icon for session type
     */
    const getSessionIcon = (sessionName: string): string => {
        const name = sessionName.toLowerCase();
        if (name.includes('practice')) return '🏎️';
        if (name.includes('qualifying') || name.includes('sprint shootout')) return '⏱️';
        if (name.includes('sprint')) return '🏁';
        if (name.includes('race')) return '🏆';
        return '📋';
    };

    /**
     * Format session date/time
     */
    const formatSessionDateTime = (dateStart: string): string => {
        const date = new Date(dateStart);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handlePress = () => {
        navigation.navigate('FreePracticeScreen', {
            sessionKey: session.session_key,
            sessionName: session.session_name,
            meetingName: meetingName,
        });
    };

    return (
        <TouchableOpacity
            style={styles.sessionCard}
            activeOpacity={0.7}
            onPress={handlePress}
        >
            <View style={styles.sessionIcon}>
                <Text style={styles.sessionIconText}>
                    {getSessionIcon(session.session_name)}
                </Text>
            </View>

            <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>
                    {session.session_name}
                </Text>
                <Text style={styles.sessionDateTime}>
                    {formatSessionDateTime(session.date_start)}
                </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    sessionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sessionIconText: {
        fontSize: 24,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 4,
    },
    sessionDateTime: {
        fontSize: 13,
        color: '#666',
    },
    chevron: {
        fontSize: 26,
        color: '#CCC',
        marginLeft: 8,
    },
});