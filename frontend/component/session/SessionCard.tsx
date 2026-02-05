import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../../../backend/types';
import { resolveSessionTheme, formatSessionDateTime } from '../../../utils/session';

interface SessionCardProps {
    session: Session;
    onPress?: (session: Session) => void;
}

export default function SessionCard({ session, onPress }: SessionCardProps) {
    const theme = useMemo(() => resolveSessionTheme(session.session_name), [session.session_name]);

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
                <Text style={styles.date}>{formatSessionDateTime(session)}</Text>
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
