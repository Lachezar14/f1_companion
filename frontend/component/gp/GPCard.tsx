import React from 'react';
import {
    colors,
    overlays,
    radius,
    semanticColors,
    shadows,
    spacing,
    typography,
} from '../../theme/tokens';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Meeting } from '../../../backend/types';

interface GPCardProps {
    meeting: Meeting;
}

type NavigationProp = NativeStackNavigationProp<any>;

const fallbackFlag =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';
const DAY_MS = 24 * 60 * 60 * 1000;

type CardStatus = 'UPCOMING' | 'LIVE' | 'FINISHED' | 'TBC';

const formatDateRange = (startIso: string, endIso: string): string => {
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Date TBC';
    }

    const sameMonth = start.getMonth() === end.getMonth();
    const sameDay = start.toDateString() === end.toDateString();

    if (sameDay) {
        return start.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    }

    if (sameMonth) {
        return `${start.toLocaleDateString('en-US', {
            month: 'short',
        })} ${start.getDate()}-${end.getDate()}`;
    }

    const startLabel = start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
    const endLabel = end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
    return `${startLabel} - ${endLabel}`;
};

const resolveStatus = (startTs: number, endTs: number): CardStatus => {
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
        return 'TBC';
    }

    const now = Date.now();
    if (startTs > now) {
        return 'UPCOMING';
    }
    if (endTs < now) {
        return 'FINISHED';
    }
    return 'LIVE';
};

const resolveTimeHint = (status: CardStatus, startTs: number): string => {
    if (status === 'TBC') {
        return 'TBC';
    }

    if (status === 'LIVE') {
        return 'Live now';
    }

    if (status === 'FINISHED') {
        return 'Completed';
    }

    const now = Date.now();
    const daysLeft = Math.ceil((startTs - now) / DAY_MS);
    if (daysLeft <= 1) {
        return 'Tomorrow';
    }
    return `In ${daysLeft}d`;
};

const resolveStatusPalette = (status: CardStatus) => {
    if (status === 'LIVE') {
        return {
            accent: colors.flags.green,
            badgeBg: '#E6F8EE',
            badgeText: '#12753D',
        };
    }

    if (status === 'FINISHED') {
        return {
            accent: '#8A90A3',
            badgeBg: '#EEF1F7',
            badgeText: '#4D5166',
        };
    }

    if (status === 'TBC') {
        return {
            accent: '#8A90A3',
            badgeBg: '#F2F4F8',
            badgeText: '#697087',
        };
    }

    return {
        accent: colors.brand.primary,
        badgeBg: semanticColors.dangerSoft,
        badgeText: semanticColors.dangerStrong,
    };
};

export default function GPCard({ meeting }: GPCardProps) {
    const navigation = useNavigation<NavigationProp>();

    const handlePress = () => {
        navigation.navigate('GPScreen', { gpKey: meeting.meeting_key, year: meeting.year });
    };

    const startTs = new Date(meeting.date_start).getTime();
    const endTs = new Date(meeting.date_end).getTime();
    const status = resolveStatus(startTs, endTs);
    const palette = resolveStatusPalette(status);
    const dateRange = formatDateRange(meeting.date_start, meeting.date_end);
    const timeHint = resolveTimeHint(status, startTs);
    const circuitLabel = meeting.circuit_short_name || meeting.circuit_type || 'Circuit TBC';

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.88}>
            <ImageBackground
                source={{ uri: meeting.country_flag || fallbackFlag }}
                style={styles.flagPanel}
                imageStyle={styles.flagImage}
            >
                <View style={styles.flagOverlay} />
                <View style={styles.flagPanelContent}>
                    <Text style={styles.countryCode}>{meeting.country_code || 'GP'}</Text>
                    <Text style={styles.countryName} numberOfLines={1}>
                        {meeting.country_name}
                    </Text>
                </View>
            </ImageBackground>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={styles.title} numberOfLines={2}>
                        {meeting.meeting_name}
                    </Text>
                    <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="rgba(255,255,255,0.82)"
                        style={styles.chevron}
                    />
                </View>

                <View style={styles.metaRow}>
                    <View style={styles.infoChip}>
                        <Ionicons
                            name="calendar-outline"
                            size={13}
                            color="rgba(255,255,255,0.75)"
                        />
                        <Text style={styles.infoChipText}>{dateRange}</Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: palette.badgeBg }]}>
                        {status === 'LIVE' ? (
                            <View style={[styles.liveDot, { backgroundColor: palette.accent }]} />
                        ) : (
                            <Ionicons
                                name={status === 'UPCOMING' ? 'time-outline' : 'checkmark-circle-outline'}
                                size={12}
                                color={palette.badgeText}
                                style={styles.statusIcon}
                            />
                        )}
                        <Text style={[styles.statusText, { color: palette.badgeText }]}>
                            {status}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.72)" />
                    <Text style={styles.infoText} numberOfLines={1}>
                        {meeting.location}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="speedometer-outline" size={14} color="rgba(255,255,255,0.72)" />
                    <Text style={styles.infoText} numberOfLines={1}>
                        {circuitLabel}
                    </Text>
                    <View style={styles.infoSpacer} />
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.infoRightText}>{timeHint}</Text>
                </View>
            </View>
            <View style={[styles.racingStripe, { backgroundColor: palette.accent }]} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: colors.neutral.carbon,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: overlays.white12,
        minHeight: 128,
        ...shadows.level2,
    },
    flagPanel: {
        width: 116,
        justifyContent: 'flex-end',
    },
    flagImage: {
        opacity: 0.9,
    },
    flagOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    flagPanelContent: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: 'rgba(0,0,0,0.22)',
    },
    countryCode: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.black,
        letterSpacing: typography.letterSpacing.wider,
    },
    countryName: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: typography.size.xs,
        fontWeight: typography.weight.medium,
        marginTop: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    title: {
        flex: 1,
        fontSize: typography.size.base,
        lineHeight: 19,
        fontWeight: typography.weight.bold,
        color: semanticColors.textInverse,
    },
    chevron: {
        marginTop: 1,
        marginLeft: spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overlays.white10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.xs,
        paddingVertical: 5,
        marginRight: spacing.xs,
        flex: 1,
    },
    infoChipText: {
        marginLeft: 5,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: typography.weight.semibold,
        letterSpacing: typography.letterSpacing.wide,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.pill,
        paddingHorizontal: spacing.xs,
        paddingVertical: 5,
        maxWidth: 100,
    },
    statusIcon: {
        marginRight: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: radius.pill,
        marginRight: 5,
    },
    statusText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: typography.letterSpacing.wide,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    infoText: {
        marginLeft: 6,
        flex: 1,
        fontSize: typography.size.sm,
        color: 'rgba(255,255,255,0.84)',
    },
    infoSpacer: {
        width: spacing.xs,
    },
    infoRightText: {
        marginLeft: 5,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.88)',
        fontWeight: typography.weight.semibold,
    },
    racingStripe: {
        width: 3,
    },
});
