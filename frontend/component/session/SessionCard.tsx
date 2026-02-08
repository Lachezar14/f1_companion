import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../../../backend/types';
import { resolveSessionTheme, formatSessionDateTime } from '../../../utils/session';

interface SessionCardProps {
    session: Session;
    onPress?: (session: Session) => void;
    showDivider?: boolean;
}

export default function SessionCard({ session, onPress, showDivider = false }: SessionCardProps) {
    const theme = useMemo(() => resolveSessionTheme(session.session_name), [session.session_name]);

    return (
        <View style={styles.rowContainer}>
            <TouchableOpacity
                style={styles.row}
                activeOpacity={0.85}
                onPress={() => onPress?.(session)}
            >
                <View style={[styles.iconBadge, { backgroundColor: theme.tint }]}>
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
            {showDivider ? <View style={styles.divider} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    rowContainer: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    iconBadge: {
        width: 52,
        height: 52,
        borderRadius: 14,
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
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E3E3E3',
        marginLeft: 68,
    },
});
