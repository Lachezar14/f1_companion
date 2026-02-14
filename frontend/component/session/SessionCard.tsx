import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../../../backend/types';
import { resolveSessionTheme, formatSessionDateTime } from '../../../utils/session';
import { radius, semanticColors, spacing, typography } from '../../theme/tokens';

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

                <Ionicons name="chevron-forward" size={20} color={semanticColors.textMuted} />
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
        paddingVertical: spacing.md,
    },
    iconBadge: {
        width: 52,
        height: 52,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
        marginBottom: spacing.xxs,
    },
    date: {
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: semanticColors.border,
        marginLeft: 18,
    },
});
