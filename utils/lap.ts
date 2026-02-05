import type { Lap, Stint } from '../backend/types';

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

    const compoundMap = new Map<string, { total: number; count: number }>();

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

        const stint = stints.find(s => lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end);
        if (!stint) {
            return;
        }

        const existing = compoundMap.get(stint.compound) || { total: 0, count: 0 };
        compoundMap.set(stint.compound, {
            total: existing.total + lap.lap_duration,
            count: existing.count + 1,
        });
    });

    return Array.from(compoundMap.entries()).map(([compound, data]) => ({
        compound,
        avgTime: data.total / data.count,
        lapCount: data.count,
    }));
};

