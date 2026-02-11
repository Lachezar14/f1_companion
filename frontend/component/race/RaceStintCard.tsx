import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import { getAverageLapTime, getBestLapTime } from '../../../utils/lap';
import { getTyreStatus, getCompoundName } from '../../../utils/tyre';
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
    const tyreStatus = getTyreStatus(stint.tyre_age_at_start);
    const compoundName = getCompoundName(stint.compound);
    const scSet = safetyCarLapSet ?? EMPTY_SET;
    const isNewTyre = !stint.tyre_age_at_start || stint.tyre_age_at_start <= 0;

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

    const renderLapNote = (lap: Lap): { label: string; style: 'default' | 'sc' | 'pit' } => {
        if (lap.is_pit_out_lap) {
            return { label: 'Pit Out', style: 'pit' };
        }
        if (scSet.has(lap.lap_number)) {
            return { label: 'SC', style: 'sc' };
        }
        return { label: '—', style: 'default' };
    };

    const isLapSelectable = (lap: Lap) => Boolean(lap.lap_duration && lap.lap_duration > 0);

    return (
        <View style={[styles.container, showDivider && styles.containerDivider]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.overline}>Stint {stint.stint_number}</Text>
                    <Text style={styles.title}>{compoundName} Run</Text>
                </View>
                <View style={styles.tyreInfo}>
                    <View
                        style={[
                            styles.tyreBadgeWrapper,
                            isNewTyre ? styles.tyreBadgeNew : styles.tyreBadgeUsed,
                        ]}
                    >
                        <TyreCompoundBadge compound={stint.compound} size={40} />
                    </View>
                    <Text
                        style={[
                            styles.tyreStateLabel,
                            isNewTyre ? styles.tyreStateLabelNew : styles.tyreStateLabelUsed,
                        ]}
                    >
                        {isNewTyre ? 'New' : 'Used'}
                    </Text>
                </View>
            </View>

            <View style={styles.statRow}>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Avg Pace</Text>
                    <Text style={styles.statValue}>
                        {averageLap ? formatLapTime(averageLap) : '—'}
                    </Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Best Lap</Text>
                    <Text style={styles.statValue}>{bestLap ? formatLapTime(bestLap) : '—'}</Text>
                </View>
            </View>
            <Text style={styles.selectionHint}>
                Tap laps to include/exclude them from the averages
            </Text>

            <View style={styles.lapTable}>
                <View style={styles.lapHeader}>
                    <Text style={[styles.headerText, { flex: 1 }]}>Lap</Text>
                    <Text style={[styles.headerText, { flex: 1 }]}>Time</Text>
                    <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Notes</Text>
                </View>
                {sortedLaps.length ? (
                    sortedLaps.map(lap => {
                        const canSelect = isLapSelectable(lap);
                        const isSelected = selectedLapNumbers.includes(lap.lap_number);
                        const note = renderLapNote(lap);
                        return (
                            <TouchableOpacity
                                key={lap.lap_number}
                                activeOpacity={canSelect ? 0.85 : 1}
                                onPress={() => handleToggleLap(lap.lap_number, canSelect)}
                                style={[
                                    styles.lapRow,
                                    !canSelect && styles.disabledLapRow,
                                    canSelect && !isSelected && styles.unselectedRow,
                                ]}
                            >
                                <View style={styles.checkboxContainer}>
                                    <View
                                        style={[
                                            styles.checkbox,
                                            !canSelect && styles.checkboxDisabled,
                                            canSelect && isSelected && styles.checkboxChecked,
                                        ]}
                                    >
                                        {canSelect && isSelected && (
                                            <Text style={styles.checkboxTick}>✓</Text>
                                        )}
                                    </View>
                                </View>
                                <View
                                    style={[
                                        styles.lapBadge,
                                        canSelect
                                            ? isSelected
                                                ? styles.lapBadgeSelected
                                                : styles.lapBadgeUnselected
                                            : styles.disabledBadge,
                                    ]}
                                >
                                    <Text style={styles.lapBadgeText}>#{lap.lap_number}</Text>
                                </View>
                                <Text style={styles.lapTime}>
                                    {lap.lap_duration ? formatLapTime(lap.lap_duration) : '—'}
                                </Text>
                                <View style={styles.noteCell}>
                                    {note.style === 'default' ? (
                                        <Text style={styles.notePlaceholder}>{note.label}</Text>
                                    ) : (
                                        <View
                                            style={[
                                                styles.noteBadge,
                                                note.style === 'sc' ? styles.scBadge : styles.pitBadge,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.noteBadgeText,
                                                    note.style === 'sc'
                                                        ? styles.scBadgeText
                                                        : styles.pitBadgeText,
                                                ]}
                                            >
                                                {note.label}
                                            </Text>
                                        </View>
                                    )}
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
        paddingVertical: 18,
    },
    containerDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#E4E7F0',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tyreInfo: {
        alignItems: 'flex-end',
    },
    tyreBadgeWrapper: {
        padding: 6,
        borderRadius: 999,
        marginBottom: 6,
    },
    tyreBadgeNew: {
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.5)',
    },
    tyreBadgeUsed: {
        backgroundColor: 'rgba(230, 230, 230, 0.4)',
        borderWidth: 1,
        borderColor: '#C5C7D5',
    },
    tyreStateLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    tyreStateLabelNew: {
        color: '#2A8C49',
    },
    tyreStateLabelUsed: {
        color: '#6B708C',
    },
    overline: {
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: '#7C7C85',
        fontWeight: '700',
    },
    title: {
        marginTop: 4,
        fontSize: 20,
        fontWeight: '700',
        color: '#15151E',
        textTransform: 'capitalize',
    },
    subtitle: {
        marginTop: 2,
        fontSize: 14,
        color: '#7C7C85',
    },
    metaText: {
        marginTop: 4,
        fontSize: 13,
        color: '#9BA1B8',
    },
    statRow: {
        flexDirection: 'row',
        gap: 10,
    },
    statPill: {
        flex: 1,
        backgroundColor: '#F5F6FA',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    statLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#8A8FA8',
        fontWeight: '700',
    },
    statValue: {
        marginTop: 6,
        fontSize: 18,
        fontWeight: '700',
        color: '#1B1E2D',
    },
    selectionHint: {
        marginTop: 14,
        fontSize: 12,
        color: '#8C91A8',
        fontStyle: 'italic',
    },
    lapTable: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#E3E5EF',
        borderRadius: 14,
        overflow: 'hidden',
    },
    lapHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#F7F8FC',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E7E9F2',
    },
    headerText: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '700',
        color: '#8B90A8',
    },
    lapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#EFF0F5',
    },
    unselectedRow: {
        opacity: 0.6,
    },
    disabledLapRow: {
        opacity: 0.45,
    },
    checkboxContainer: {
        marginRight: 12,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#C8CCDA',
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 13,
        fontWeight: '700',
    },
    lapBadge: {
        minWidth: 58,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    lapBadgeSelected: {
        backgroundColor: '#15151E',
    },
    lapBadgeUnselected: {
        backgroundColor: '#E4E7F2',
    },
    disabledBadge: {
        backgroundColor: '#F0F1F6',
    },
    lapBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFF',
    },
    lapTime: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2333',
    },
    noteCell: {
        flex: 1,
        alignItems: 'flex-end',
    },
    noteBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    noteBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
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
    notePlaceholder: {
        fontSize: 13,
        color: '#9CA1BA',
    },
    emptyState: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#8C90A6',
        fontStyle: 'italic',
    },
});
