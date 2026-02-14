import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import { getAverageLapTime, getBestLapTime } from '../../../utils/lap';
import { getCompoundName } from '../../../utils/tyre';
import StintHeader from './StintHeader';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../theme/tokens';

interface StintCardProps {
    stint: Stint;
    laps: Lap[];
    showDivider?: boolean;
    safetyCarLapSet?: Set<number>;
    pitInLapSet?: Set<number>;
}

const EMPTY_SET: Set<number> = new Set();

export default function StintCard({
    stint,
    laps,
    showDivider = false,
    safetyCarLapSet,
    pitInLapSet,
}: StintCardProps) {
    const sortedLaps = useMemo(() => [...laps].sort((a, b) => a.lap_number - b.lap_number), [laps]);
    const selectableLapNumbers = useMemo(
        () => sortedLaps.filter(lap => lap.lap_duration && lap.lap_duration > 0).map(lap => lap.lap_number),
        [sortedLaps]
    );
    const selectableSignature = useMemo(() => selectableLapNumbers.join(','), [selectableLapNumbers]);
    const [selectedLapNumbers, setSelectedLapNumbers] = useState<number[]>(selectableLapNumbers);

    useEffect(() => {
        setSelectedLapNumbers(selectableLapNumbers);
    }, [selectableSignature, selectableLapNumbers]);

    const selectedLapObjects = useMemo(
        () =>
            sortedLaps.filter(
                lap =>
                    lap.lap_duration &&
                    lap.lap_duration > 0 &&
                    selectedLapNumbers.includes(lap.lap_number)
            ),
        [sortedLaps, selectedLapNumbers]
    );

    const loggedLaps = selectableLapNumbers.length;
    const selectedLapCount = selectedLapNumbers.length;
    const averageLap = getAverageLapTime(selectedLapObjects);
    const bestLap = getBestLapTime(selectedLapObjects);
    const fastestLapInStint = useMemo(
        () =>
            sortedLaps.reduce<Lap | null>((best, lap) => {
                if (!lap.lap_duration || lap.lap_duration <= 0) return best;
                if (!best || (lap.lap_duration as number) < (best.lap_duration as number)) {
                    return lap;
                }
                return best;
            }, null),
        [sortedLaps]
    );
    const compoundName = getCompoundName(stint.compound);
    const scSet = safetyCarLapSet ?? EMPTY_SET;
    const isNewTyre = !stint.tyre_age_at_start || stint.tyre_age_at_start <= 0;
    const derivedPitInLapSet = useMemo(() => {
        const lapsBeforePitOut = sortedLaps
            .filter(lap => lap.is_pit_out_lap)
            .map(lap => lap.lap_number - 1)
            .filter(lapNumber => lapNumber > 0);
        return new Set(lapsBeforePitOut);
    }, [sortedLaps]);
    const effectivePitInLapSet = useMemo(() => {
        if (!pitInLapSet) {
            return derivedPitInLapSet;
        }
        const merged = new Set<number>(derivedPitInLapSet);
        pitInLapSet.forEach(lapNumber => merged.add(lapNumber));
        return merged;
    }, [derivedPitInLapSet, pitInLapSet]);

    const handleToggleLap = (lapNumber: number, canSelect: boolean) => {
        if (!canSelect) return;
        setSelectedLapNumbers(prev => {
            const exists = prev.includes(lapNumber);
            if (exists) {
                return prev.filter(num => num !== lapNumber);
            }
            const next = [...prev, lapNumber];
            return next.sort((a, b) => a - b);
        });
    };

    const renderLapNotes = (lap: Lap): Array<{ label: string; style: 'sc' | 'pit' | 'pitIn' }> => {
        const notes: Array<{ label: string; style: 'sc' | 'pit' | 'pitIn' }> = [];
        if (effectivePitInLapSet.has(lap.lap_number)) {
            notes.push({ label: 'Pit In', style: 'pitIn' });
        }
        if (lap.is_pit_out_lap) {
            notes.push({ label: 'Pit Out', style: 'pit' });
        }
        if (scSet.has(lap.lap_number)) {
            notes.push({ label: 'SC', style: 'sc' });
        }
        return notes;
    };

    const isLapSelectable = (lap: Lap) => Boolean(lap.lap_duration && lap.lap_duration > 0);

    return (
        <View style={[styles.container, showDivider && styles.containerDivider]}>
            <StintHeader
                stintNumber={stint.stint_number}
                compound={stint.compound}
                title={compoundName}
                subtitle={`Laps ${stint.lap_start} – ${stint.lap_end}`}
                meta={`${selectedLapCount}/${loggedLaps} clean laps selected`}
                isNewTyre={isNewTyre}
                tyreStateLabel={isNewTyre ? 'New tyre' : 'Used tyre'}
            />

            <View style={styles.statRow}>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Avg Pace</Text>
                    <Text style={styles.statValue}>{averageLap ? formatLapTime(averageLap) : '—'}</Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Best Lap</Text>
                    <Text style={styles.statValue}>{bestLap ? formatLapTime(bestLap) : '—'}</Text>
                </View>
            </View>
            <Text style={styles.selectionHint}>
                Tap lap rows to include/exclude them from pace metrics
            </Text>

            <View style={styles.lapList}>
                {sortedLaps.length ? (
                    sortedLaps.map((lap, index) => {
                        const canSelect = isLapSelectable(lap);
                        const isSelected = selectedLapNumbers.includes(lap.lap_number);
                        const notes = renderLapNotes(lap);
                        const isFastestLap =
                            fastestLapInStint?.lap_number === lap.lap_number &&
                            fastestLapInStint?.date_start === lap.date_start;

                        return (
                            <TouchableOpacity
                                key={`${lap.lap_number}-${index}`}
                                activeOpacity={canSelect ? 0.86 : 1}
                                onPress={() => handleToggleLap(lap.lap_number, canSelect)}
                                style={[
                                    styles.lapCard,
                                    scSet.has(lap.lap_number) && styles.scLapCard,
                                    isFastestLap && styles.fastestLapCard,
                                    !canSelect && styles.disabledLapCard,
                                    canSelect && !isSelected && styles.unselectedLapCard,
                                    index === sortedLaps.length - 1 && styles.lapCardLast,
                                ]}
                            >
                                <View style={styles.lapTopRow}>
                                    <View style={styles.lapTopLeft}>
                                        <View
                                            style={[
                                                styles.checkbox,
                                                !canSelect && styles.checkboxDisabled,
                                                canSelect && isSelected && styles.checkboxChecked,
                                            ]}
                                        >
                                            {canSelect && isSelected ? (
                                                <Text style={styles.checkboxTick}>✓</Text>
                                            ) : null}
                                        </View>
                                        <Text style={styles.lapNumber}>Lap {lap.lap_number}</Text>
                                        {notes.length || isFastestLap ? (
                                            <View style={styles.noteBadgeRow}>
                                                {isFastestLap ? (
                                                    <View style={styles.fastestBadge}>
                                                        <Ionicons
                                                            name="timer-outline"
                                                            size={10}
                                                            color="#5A3CA8"
                                                        />
                                                        <Text style={styles.fastestBadgeText}>FASTEST</Text>
                                                    </View>
                                                ) : null}
                                                {notes.map((note, noteIndex) => (
                                                    <View
                                                        key={`${note.label}-${noteIndex}`}
                                                        style={[
                                                            styles.noteBadge,
                                                            note.style === 'sc'
                                                                ? styles.scBadge
                                                                : note.style === 'pitIn'
                                                                    ? styles.pitInBadge
                                                                    : styles.pitBadge,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.noteBadgeText,
                                                                note.style === 'sc'
                                                                    ? styles.scBadgeText
                                                                    : note.style === 'pitIn'
                                                                        ? styles.pitInBadgeText
                                                                        : styles.pitBadgeText,
                                                            ]}
                                                        >
                                                            {note.label}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={styles.lapTime}>
                                        {lap.lap_duration ? formatLapTime(lap.lap_duration) : '—'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No laps recorded for this stint</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: spacing.sm,
    },
    containerDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E4E7F0',
    },
    statRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        gap: spacing.xs,
    },
    statPill: {
        flex: 1,
        backgroundColor: '#F5F6FA',
        borderRadius: radius.md,
        paddingVertical: 9,
        paddingHorizontal: spacing.sm,
    },
    statLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#8388A1',
        fontWeight: typography.weight.bold,
    },
    statValue: {
        marginTop: spacing.xxs,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: '#1B1E2D',
    },
    selectionHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: '#8C91A8',
    },
    lapList: {
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: '#E3E5EF',
        borderRadius: radius.md,
        backgroundColor: semanticColors.surface,
        overflow: 'hidden',
    },
    lapCard: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E8F2',
    },
    scLapCard: {
        backgroundColor: 'rgba(255, 218, 103, 0.2)',
    },
    fastestLapCard: {
        backgroundColor: 'rgba(172, 140, 255, 0.16)',
        borderLeftWidth: 2,
        borderLeftColor: colors.accents.lavender,
    },
    lapCardLast: {
        borderBottomWidth: 0,
    },
    unselectedLapCard: {
        opacity: 0.6,
    },
    disabledLapCard: {
        opacity: 0.45,
    },
    lapTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lapTopLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#C8CCDA',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: semanticColors.surface,
    },
    checkboxChecked: {
        backgroundColor: semanticColors.textPrimary,
        borderColor: semanticColors.textPrimary,
    },
    checkboxDisabled: {
        borderColor: '#D5D8E6',
    },
    checkboxTick: {
        color: semanticColors.surface,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
    },
    lapNumber: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#252A3E',
    },
    lapTime: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: '#1F2333',
    },
    noteBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 3,
        borderRadius: radius.sm,
    },
    noteBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    fastestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.xs,
        paddingVertical: 3,
        borderRadius: radius.sm,
        backgroundColor: '#F8F5FF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E2DAFF',
    },
    fastestBadgeText: {
        fontSize: 10,
        fontWeight: typography.weight.heavy,
        letterSpacing: 0.3,
        color: '#5A3CA8',
    },
    noteBadgeText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        letterSpacing: 0.3,
    },
    scBadge: {
        backgroundColor: '#fad98b',
    },
    scBadgeText: {
        color: '#3B2A00',
    },
    pitBadge: {
        backgroundColor: overlays.brand12,
    },
    pitBadgeText: {
        color: semanticColors.dangerStrong,
    },
    pitInBadge: {
        backgroundColor: 'rgba(255, 125, 0, 0.15)',
    },
    pitInBadgeText: {
        color: '#A65200',
    },
    emptyState: {
        padding: spacing.md,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.size.sm,
        color: '#8C90A6',
        fontStyle: 'italic',
    },
});
