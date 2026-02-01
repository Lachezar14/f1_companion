import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../../../backend/types';

interface SessionCardProps {
    session: Session;
    onPress?: (session: Session) => void;
}

type SessionTheme = {
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    tint: string;
};

const THEMES: Record<'practice' | 'qualifying' | 'sprint' | 'race' | 'default', SessionTheme> = {
    practice: { icon: 'speedometer', accent: '#3EC5FF', tint: 'rgba(62,197,255,0.15)' },
    qualifying: { icon: 'stopwatch', accent: '#FF8A5C', tint: 'rgba(255,138,92,0.15)' },
    sprint: { icon: 'flag', accent: '#AC8CFF', tint: 'rgba(172,140,255,0.15)' },
    race: { icon: 'trophy', accent: '#6DE19C', tint: 'rgba(109,225,156,0.15)' },
    default: { icon: 'document-text', accent: '#9BA3AE', tint: 'rgba(155,163,174,0.15)' },
};

const resolveTheme = (sessionName: string): SessionTheme => {
    const name = sessionName.toLowerCase();
    if (name.includes('practice')) return THEMES.practice;
    if (name.includes('qualifying') || name.includes('shootout')) return THEMES.qualifying;
    if (name.includes('sprint')) return THEMES.sprint;
    if (name.includes('race')) return THEMES.race;
    return THEMES.default;
};

const formatDateTime = (session: Session): string => {
    const date = new Date(session.date_start);
    return `${date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })}${session.gmt_offset ? ` · ${session.gmt_offset}` : ''}`;
};

export default function SessionCard({ session, onPress }: SessionCardProps) {
    const theme = useMemo(() => resolveTheme(session.session_name), [session.session_name]);

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: theme.accent }]}
            activeOpacity={0.85}
            onPress={() => onPress?.(session)}
        >
            <View style={[styles.iconCircle, { backgroundColor: theme.tint }]}>
                <Ionicons name={theme.icon} size={22} color={theme.accent} />
            </View>

            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                    {session.session_name}
                </Text>
                <Text style={styles.date}>{formatDateTime(session)}</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#B8B8B8" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 18,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#ECECEC',
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#15151E',
        marginBottom: 4,
    },
    date: {
        fontSize: 13,
        color: '#777',
    },
});
