import type { Lap, Stint } from '../backend/types';

const normalizeCompoundLabel = (compound?: string | null): string | null => {
    if (typeof compound !== 'string') {
        return null;
    }
    const trimmed = compound.trim();
    return trimmed.length ? trimmed : null;
};

export const getAverageLapTime = (laps: Lap[]): number | null => {
    const cleanLaps = laps.filter(lap => lap.lap_duration && lap.lap_duration > 0);
    if (!cleanLaps.length) {
        return null;
    }
    const total = cleanLaps.reduce((sum, lap) => sum + (lap.lap_duration as number), 0);
    return total / cleanLaps.length;
};

export const getBestLapTime = (laps: Lap[]): number | null => {
    let best: number | null = null;
    laps.forEach(lap => {
        if (!lap.lap_duration || lap.lap_duration <= 0) {
            return;
        }
        if (best === null || lap.lap_duration < best) {
            best = lap.lap_duration;
        }
    });
    return best;
};

export const calculateTypicalLapDuration = (laps: Lap[]): number | null => {
    const sortedDurations = laps
        .filter(lap => !lap.is_pit_out_lap && lap.lap_duration && lap.lap_duration > 0)
        .map(lap => lap.lap_duration as number)
        .sort((a, b) => a - b);

    if (!sortedDurations.length) {
        return null;
    }

    const middle = Math.floor(sortedDurations.length / 2);
    if (sortedDurations.length % 2 === 0) {
        return (sortedDurations[middle - 1] + sortedDurations[middle]) / 2;
    }
    return sortedDurations[middle];
};

export type CompoundStat = {
    compound: string;
    avgTime: number;
    lapCount: number;
};

type AvgLapTimeOptions = {
    lapThreshold?: number | null;
    excludedLapNumbers?: Set<number> | number[];
    includePitOutLaps?: boolean;
};

export const calculateAvgLapTimePerCompound = (
    laps: Lap[],
    stints: Stint[],
    options: AvgLapTimeOptions = {}
): CompoundStat[] => {
    const {
        lapThreshold = null,
        excludedLapNumbers,
        includePitOutLaps = false,
    } = options;

    const excluded = Array.isArray(excludedLapNumbers)
        ? new Set(excludedLapNumbers)
        : excludedLapNumbers ?? new Set<number>();

    const compoundByLapNumber = new Map<number, string>();
    const orderedStints = [...stints].sort(
        (a, b) => a.lap_start - b.lap_start || a.stint_number - b.stint_number
    );
    orderedStints.forEach(stint => {
        const compoundLabel = normalizeCompoundLabel(stint.compound);
        if (!compoundLabel) {
            return;
        }

        for (let lapNumber = stint.lap_start; lapNumber <= stint.lap_end; lapNumber++) {
            if (!compoundByLapNumber.has(lapNumber)) {
                compoundByLapNumber.set(lapNumber, compoundLabel);
            }
        }
    });

    const compoundMap = new Map<string, { total: number; count: number; label: string }>();

    laps.forEach(lap => {
        if (!lap.lap_duration || lap.lap_duration <= 0) {
            return;
        }
        if (!includePitOutLaps && lap.is_pit_out_lap) {
            return;
        }
        if (lapThreshold !== null && lap.lap_duration > lapThreshold) {
            return;
        }
        if (excluded.has(lap.lap_number)) {
            return;
        }

        const compoundLabel = compoundByLapNumber.get(lap.lap_number);
        if (!compoundLabel) {
            return;
        }

        const compoundKey = compoundLabel.toLowerCase();
        const lapDuration = lap.lap_duration as number;
        const existing = compoundMap.get(compoundKey);

        if (existing) {
            existing.total += lapDuration;
            existing.count += 1;
        } else {
            compoundMap.set(compoundKey, {
                total: lapDuration,
                count: 1,
                label: compoundLabel,
            });
        }
    });

    return Array.from(compoundMap.values()).map(data => ({
        compound: data.label,
        avgTime: data.total / data.count,
        lapCount: data.count,
    }));
};

export type StintLapGroup = {
    stint: Stint;
    laps: Lap[];
};

export const groupLapsByStints = (laps: Lap[], stints: Stint[]): StintLapGroup[] => {
    const orderedStints = [...stints].sort(
        (a, b) => a.lap_start - b.lap_start || a.stint_number - b.stint_number
    );
    const orderedLaps = [...laps].sort((a, b) => a.lap_number - b.lap_number);
    let lapIndex = 0;
    let lastAssignedLap = Number.NEGATIVE_INFINITY;

    return orderedStints.map(stint => {
        const rangeStart = Math.max(stint.lap_start, lastAssignedLap + 1);
        const rangeEnd = stint.lap_end;

        while (lapIndex < orderedLaps.length && orderedLaps[lapIndex].lap_number < rangeStart) {
            lapIndex += 1;
        }

        const startIndex = lapIndex;
        while (lapIndex < orderedLaps.length && orderedLaps[lapIndex].lap_number <= rangeEnd) {
            lapIndex += 1;
        }
        const lapsForStint = orderedLaps.slice(startIndex, lapIndex);

        if (rangeEnd > lastAssignedLap) {
            lastAssignedLap = rangeEnd;
        }

        return {
            stint,
            laps: lapsForStint,
        };
    });
};
