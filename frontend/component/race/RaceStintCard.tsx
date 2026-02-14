import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import { getAverageLapTime, getBestLapTime } from '../../../utils/lap';
import { getCompoundName } from '../../../utils/tyre';
import TyreCompoundBadge from '../common/TyreCompoundBadge';

interface RaceStintCardProps {
    stint: Stint;
    laps: Lap[];
    showDivider?: boolean;
    safetyCarLapSet?: Set<number>;
}

const EMPTY_SET: Set<number> = new Set();

export default function RaceStintCard({
    stint,
    laps,
    showDivider = false,
    safetyCarLapSet,
}: RaceStintCardProps) {
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
    const compoundName = getCompoundName(stint.compound);
    const scSet = safetyCarLapSet ?? EMPTY_SET;
    const isNewTyre = !stint.tyre_age_at_start || stint.tyre_age_at_start <= 0;
    const pitInLapSet = useMemo(() => {
        const lapsBeforePitOut = sortedLaps
            .filter(lap => lap.is_pit_out_lap)
            .map(lap => lap.lap_number - 1)
            .filter(lapNumber => lapNumber > 0);
        return new Set(lapsBeforePitOut);
    }, [sortedLaps]);

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
        if (pitInLapSet.has(lap.lap_number)) {
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
            <View style={styles.header}>
                <Text style={styles.overline}>Stint {stint.stint_number}</Text>
                <View style={styles.compoundRow}>
                    <View style={styles.titleRow}>
                        <TyreCompoundBadge compound={stint.compound} size={28} />
                        <Text style={styles.title}>{compoundName}</Text>
                    </View>
                    <View
                        style={[
                            styles.tyreStatePill,
                            isNewTyre ? styles.tyreStatePillNew : styles.tyreStatePillUsed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.tyreStateText,
                                isNewTyre ? styles.tyreStateTextNew : styles.tyreStateTextUsed,
                            ]}
                        >
                            {isNewTyre ? 'New tyre' : 'Used tyre'}
                        </Text>
                    </View>
                </View>
            </View>

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

                        return (
                            <TouchableOpacity
                                key={`${lap.lap_number}-${index}`}
                                activeOpacity={canSelect ? 0.86 : 1}
                                onPress={() => handleToggleLap(lap.lap_number, canSelect)}
                                style={[
                                    styles.lapCard,
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
                                        {notes.length ? (
                                            <View style={styles.noteBadgeRow}>
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
        paddingVertical: 12,
    },
    containerDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E4E7F0',
    },
    header: {
        marginBottom: 2,
    },
    compoundRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    overline: {
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: '#737A95',
        fontWeight: '700',
    },
    titleRow: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#15151E',
        textTransform: 'capitalize',
    },
    metaText: {
        marginTop: 4,
        fontSize: 12,
        color: '#8288A3',
    },
    tyreStatePill: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
    },
    tyreStatePillNew: {
        backgroundColor: 'rgba(31,138,77,0.12)',
        borderColor: 'rgba(31,138,77,0.4)',
    },
    tyreStatePillUsed: {
        backgroundColor: 'rgba(106,111,135,0.12)',
        borderColor: 'rgba(106,111,135,0.35)',
    },
    tyreStateText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    tyreStateTextNew: {
        color: '#1F8A4D',
    },
    tyreStateTextUsed: {
        color: '#6A6F87',
    },
    statRow: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 8,
    },
    statPill: {
        flex: 1,
        backgroundColor: '#F5F6FA',
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 10,
    },
    statLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#8388A1',
        fontWeight: '700',
    },
    statValue: {
        marginTop: 4,
        fontSize: 16,
        fontWeight: '700',
        color: '#1B1E2D',
    },
    selectionHint: {
        marginTop: 8,
        fontSize: 11,
        color: '#8C91A8',
    },
    lapList: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E3E5EF',
        borderRadius: 12,
        backgroundColor: '#FBFCFF',
        overflow: 'hidden',
    },
    lapCard: {
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E8F2',
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
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#C8CCDA',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxChecked: {
        backgroundColor: '#15151E',
        borderColor: '#15151E',
    },
    checkboxDisabled: {
        borderColor: '#D5D8E6',
    },
    checkboxTick: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    lapNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#252A3E',
    },
    lapTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2333',
    },
    noteBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    noteBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    noteBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    scBadge: {
        backgroundColor: 'rgba(255, 218, 103, 0.35)',
    },
    scBadgeText: {
        color: '#8D6E00',
    },
    pitBadge: {
        backgroundColor: 'rgba(225, 6, 0, 0.12)',
    },
    pitBadgeText: {
        color: '#B40012',
    },
    pitInBadge: {
        backgroundColor: 'rgba(255, 125, 0, 0.15)',
    },
    pitInBadgeText: {
        color: '#A65200',
    },
    emptyState: {
        padding: 14,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#8C90A6',
        fontStyle: 'italic',
    },
});
