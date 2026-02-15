import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Session } from '../../../backend/types';
import {
    colors,
    overlays,
    radius,
    semanticColors,
    shadows,
    spacing,
    typography,
} from '../../theme/tokens';

interface SessionCardProps {
    session: Session;
    onPress?: (session: Session) => void;
    showDivider?: boolean;
}

type SessionLifecycle = 'upcoming' | 'live' | 'completed' | 'tbc';

type SessionVisual = {
    icon: string;
    accent: string;
    iconTint: string;
    label: string;
};

const resolveSessionVisual = (session: Session): SessionVisual => {
    const text = `${session.session_type || ''} ${session.session_name || ''}`.toLowerCase();

    if (text.includes('practice')) {
        return {
            icon: 'car-sports',
            accent: '#3EC5FF',
            iconTint: 'rgba(62,197,255,0.18)',
            label: 'Practice',
        };
    }

    if (text.includes('qualifying') || text.includes('shootout')) {
        return {
            icon: 'timer-outline',
            accent: '#FF8A5C',
            iconTint: 'rgba(255,138,92,0.18)',
            label: 'Qualifying',
        };
    }

    if (text.includes('sprint')) {
        return {
            icon: 'flash-outline',
            accent: '#AC8CFF',
            iconTint: 'rgba(172,140,255,0.18)',
            label: 'Sprint',
        };
    }

    if (text.includes('race') || text.includes('grand prix')) {
        return {
            icon: 'flag-checkered',
            accent: '#6DE19C',
            iconTint: 'rgba(109,225,156,0.18)',
            label: 'Race',
        };
    }

    return {
        icon: 'calendar-clock',
        accent: '#B7BDC9',
        iconTint: 'rgba(183,189,201,0.18)',
        label: 'Session',
    };
};

const getSessionLifecycle = (session: Session): SessionLifecycle => {
    const start = new Date(session.date_start).getTime();
    const end = new Date(session.date_end).getTime();

    if (Number.isNaN(start)) {
        return 'tbc';
    }

    const normalizedEnd = Number.isNaN(end) ? start : end;
    const now = Date.now();

    if (now < start) {
        return 'upcoming';
    }

    if (now > normalizedEnd) {
        return 'completed';
    }

    return 'live';
};

const formatSessionDateParts = (session: Session) => {
    const date = new Date(session.date_start);

    if (Number.isNaN(date.getTime())) {
        return {
            day: 'TBD',
            date: 'Date TBC',
            time: 'Time TBC',
            offset: session.gmt_offset || null,
        };
    }

    return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        }),
        offset: session.gmt_offset || null,
    };
};

const getStatusPresentation = (lifecycle: SessionLifecycle) => {
    if (lifecycle === 'live') {
        return { label: 'LIVE', bg: '#E6F8EE', text: '#12753D' };
    }

    if (lifecycle === 'completed') {
        return { label: 'DONE', bg: '#EEF1F7', text: '#4D5166' };
    }

    if (lifecycle === 'upcoming') {
        return { label: 'UPCOMING', bg: semanticColors.dangerSoft, text: semanticColors.dangerStrong };
    }

    return { label: 'TBC', bg: '#F2F4F8', text: '#697087' };
};

export default function SessionCard({ session, onPress, showDivider = false }: SessionCardProps) {
    const visual = useMemo(() => resolveSessionVisual(session), [session]);
    const dateParts = useMemo(() => formatSessionDateParts(session), [session]);
    const lifecycle = useMemo(() => getSessionLifecycle(session), [session]);
    const status = useMemo(() => getStatusPresentation(lifecycle), [lifecycle]);

    return (
        <View style={[styles.rowContainer, showDivider && styles.rowSpacing]}>
            <TouchableOpacity
                style={styles.row}
                activeOpacity={0.88}
                onPress={() => onPress?.(session)}
            >
                <View style={[styles.leftStripe, { backgroundColor: visual.accent }]} />

                <View style={[styles.iconBadge, { backgroundColor: visual.iconTint }]}> 
                    <MaterialCommunityIcons name={visual.icon as any} size={20} color={visual.accent} />
                </View>

                <View style={styles.info}>
                    <View style={styles.topRow}>
                        <Text style={styles.name} numberOfLines={1}>
                            {session.session_name}
                        </Text>
                        <View style={[styles.statusPill, { backgroundColor: status.bg }]}> 
                            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                        </View>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaChip}>
                            <Text style={styles.metaChipText}>{visual.label}</Text>
                        </View>

                        <View style={styles.metaChip}>
                            <MaterialCommunityIcons name="calendar-outline" size={11} color="rgba(255,255,255,0.78)" />
                            <Text style={styles.metaChipText}>{dateParts.day} {dateParts.date}</Text>
                        </View>

                        <View style={styles.metaChip}>
                            <MaterialCommunityIcons name="clock-outline" size={11} color="rgba(255,255,255,0.78)" />
                            <Text style={styles.metaChipText}>{dateParts.time}</Text>
                        </View>

                        {dateParts.offset ? (
                            <View style={[styles.metaChip, styles.offsetChip]}>
                                <Text style={styles.metaChipText}>GMT {dateParts.offset}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color="rgba(255,255,255,0.76)"
                    style={styles.chevron}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    rowContainer: {
        width: '100%',
    },
    rowSpacing: {
        marginBottom: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: overlays.white12,
        overflow: 'hidden',
        minHeight: 92,
        ...shadows.level2,
    },
    leftStripe: {
        width: 4,
        alignSelf: 'stretch',
    },
    iconBadge: {
        width: 38,
        height: 38,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    info: {
        flex: 1,
        marginLeft: spacing.sm,
        paddingVertical: spacing.sm,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    name: {
        flex: 1,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
        marginRight: spacing.xs,
    },
    statusPill: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
    },
    statusText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    metaRow: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        marginRight: spacing.xs,
        marginBottom: 4,
    },
    offsetChip: {
        backgroundColor: overlays.white16,
    },
    metaChipText: {
        marginLeft: 4,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.88)',
        fontWeight: typography.weight.medium,
        letterSpacing: typography.letterSpacing.wide,
    },
    chevron: {
        marginHorizontal: spacing.sm,
    },
});
