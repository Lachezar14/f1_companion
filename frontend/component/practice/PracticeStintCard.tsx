import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lap, Stint } from '../../../backend/types';
import { formatLapTime } from '../../../shared/time';
import { getCompoundColor, getCompoundLetter, getTyreStatus } from '../../../utils/tyre';
import { getAverageLapTime, getBestLapTime } from '../../../utils/lap';

interface PracticeStintCardProps {
    stint: Stint;
    laps: Lap[];
    showDivider?: boolean;
}

export default function PracticeStintCard({ stint, laps, showDivider = false }: PracticeStintCardProps) {
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

    const totalLaps = stint.lap_end - stint.lap_start + 1;
    const loggedLaps = selectableLapNumbers.length;
    const selectedLapCount = selectedLapNumbers.length;
    const averageLap = getAverageLapTime(selectedLapObjects);
    const bestLap = getBestLapTime(selectedLapObjects);
    const tyreStatus = getTyreStatus(stint.tyre_age_at_start);

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

    const isLapSelectable = (lap: Lap) => Boolean(lap.lap_duration && lap.lap_duration > 0);

    return (
        <View style={[styles.container, showDivider && styles.containerDivider]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.overline}>Stint {stint.stint_number}</Text>
                    <Text style={styles.title}>{stint.compound} Run</Text>
                    <Text style={styles.subtitle}>
                        Laps {stint.lap_start} – {stint.lap_end}
                    </Text>
                    <Text style={styles.metaText}>
                        Tyre age • {tyreStatus}
                    </Text>
                </View>
                <View
                    style={[
                        styles.compoundChip,
                        { backgroundColor: getCompoundColor(stint.compound) }
                    ]}
                >
                    <Text style={styles.compoundChipText}>
                        {getCompoundLetter(stint.compound)}
                    </Text>
                </View>
            </View>

            <View style={styles.statRow}>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Laps</Text>
                    <Text style={styles.statValue}>
                        {selectedLapCount}/{loggedLaps || 0}
                    </Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>AVG pace</Text>
                    <Text style={styles.statValue}>
                        {averageLap ? formatLapTime(averageLap) : '—'}
                    </Text>
                </View>
                <View style={styles.statPill}>
                    <Text style={styles.statLabel}>Best lap</Text>
                    <Text style={styles.statValue}>
                        {bestLap ? formatLapTime(bestLap) : '—'}
                    </Text>
                </View>
            </View>
            <Text style={styles.selectionHint}>Tap laps to include/exclude them from the averages</Text>

            <View style={styles.lapTable}>
                <View style={styles.lapHeader}>
                    <Text style={[styles.headerText, { flex: 1 }]}>Lap</Text>
                    <Text style={[styles.headerText, { flex: 1 }]}>Time</Text>
                    <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Notes</Text>
                </View>
                {sortedLaps.length > 0 ? (
                    sortedLaps.map(lap => {
                        const canSelect = isLapSelectable(lap);
                        const isSelected = selectedLapNumbers.includes(lap.lap_number);
                        return (
                            <TouchableOpacity
                                key={lap.lap_number}
                                activeOpacity={canSelect ? 0.85 : 1}
                                onPress={() => handleToggleLap(lap.lap_number, canSelect)}
                                style={[
                                    styles.lapRow,
                                    lap.is_pit_out_lap && styles.pitOutRow,
                                    canSelect && !isSelected && styles.unselectedRow,
                                    !canSelect && styles.disabledLapRow,
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
                                        canSelect ? (isSelected ? styles.lapBadgeSelected : styles.lapBadgeUnselected) : styles.disabledBadge,
                                    ]}
                                >
                                    <Text style={styles.lapBadgeText}>#{lap.lap_number}</Text>
                                </View>
                                <Text style={styles.lapTime}>
                                    {lap.lap_duration ? formatLapTime(lap.lap_duration) : '—'}
                                </Text>
                                <View style={styles.noteCell}>
                                    {lap.is_pit_out_lap ? (
                                        <Text style={styles.noteBadge}>Pit Out</Text>
                                    ) : (
                                        <Text style={styles.placeholder}>—</Text>
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
        borderBottomColor: '#C9CEDA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
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
        color: '#8E93A8',
    },
    compoundChip: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
    },
    compoundChipText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '800',
    },
    statRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    statPill: {
        flex: 1,
        borderRadius: 16,
        padding: 12,
        backgroundColor: '#F7F8FB',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E3E7F2',
    },
    statLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: '#7F8498',
        fontWeight: '700',
    },
    statValue: {
        marginTop: 4,
        fontSize: 16,
        fontWeight: '700',
        color: '#15151E',
    },
    selectionHint: {
        fontSize: 12,
        color: '#8C8FA3',
        marginBottom: 12,
    },
    lapTable: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E4E7F0',
        overflow: 'hidden',
    },
    lapHeader: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#F4F5FB',
    },
    headerText: {
        fontSize: 11,
        letterSpacing: 0.6,
        fontWeight: '700',
        textTransform: 'uppercase',
        color: '#7F8498',
    },
    lapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#ECEEF6',
    },
    unselectedRow: {
        opacity: 0.6,
    },
    disabledLapRow: {
        opacity: 0.5,
    },
    pitOutRow: {
        backgroundColor: 'rgba(225,6,0,0.04)',
    },
    lapBadge: {
        flex: 1,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    lapBadgeSelected: {
        backgroundColor: '#FFF',
        borderColor: '#E3E6F0',
    },
    lapBadgeUnselected: {
        backgroundColor: '#F1F2F7',
        borderColor: '#E3E6F0',
    },
    disabledBadge: {
        backgroundColor: '#F5F5F5',
        borderColor: '#E0E0E0',
    },
    checkboxContainer: {
        marginRight: 10,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.4,
        borderColor: '#CBD1E0',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF',
    },
    checkboxChecked: {
        borderColor: '#E10600',
        backgroundColor: 'rgba(225,6,0,0.12)',
    },
    checkboxDisabled: {
        borderColor: '#E0E0E0',
        backgroundColor: '#F5F5F5',
    },
    checkboxTick: {
        fontSize: 12,
        color: '#B40012',
        fontWeight: '700',
    },
    lapBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#15151E',
    },
    lapTime: {
        flex: 1,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '700',
        color: '#15151E',
    },
    noteCell: {
        flex: 1,
        alignItems: 'flex-end',
    },
    noteBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#B40012',
        backgroundColor: 'rgba(225,6,0,0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    placeholder: {
        fontSize: 12,
        color: '#9BA0B4',
    },
    emptyState: {
        padding: 14,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#9BA0B4',
        fontStyle: 'italic',
    },
});
