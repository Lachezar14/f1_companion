import type { SessionDriverData } from '../../../../backend/types';

export type FuelLoad = 'heavy' | 'medium' | 'low';

export type FuelLoadBounds = {
    totalLaps: number;
    heavyEndLap: number;
    mediumEndLap: number;
};

export const OVERALL_FILTER = 'overall';

export const FUEL_LOAD_ORDER: FuelLoad[] = ['heavy', 'medium', 'low'];

export const isValidPositiveNumber = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

export const average = (values: number[]): number | null => {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const median = (values: number[]): number | null => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
};

export const standardDeviation = (values: number[]): number | null => {
    const avg = average(values);
    if (avg == null) return null;
    const variance =
        values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / values.length;
    return Math.sqrt(variance);
};

export const getRaceLapCount = (
    rows: Array<{ laps: number }>,
    driverEntries: SessionDriverData[]
): number => {
    if (rows[0]?.laps) return rows[0].laps;
    return driverEntries.reduce((max, entry) => Math.max(max, entry.laps.length), 0);
};

export const getFuelLoadBounds = (
    driverEntries: SessionDriverData[],
    raceLapCount: number
): FuelLoadBounds => {
    const maxLapFromEntries = driverEntries.reduce((max, entry) => {
        const entryMax = entry.laps.reduce((lapMax, lap) => Math.max(lapMax, lap.lap_number), 0);
        return Math.max(max, entryMax);
    }, 0);

    const totalLaps = raceLapCount > 0 ? raceLapCount : maxLapFromEntries;
    const normalizedTotal = Math.max(1, totalLaps);
    const heavyEndLap = Math.ceil(normalizedTotal / 3);
    const mediumEndLap = Math.ceil((2 * normalizedTotal) / 3);

    return {
        totalLaps: normalizedTotal,
        heavyEndLap,
        mediumEndLap,
    };
};

export const getFuelLoadForLap = (lapNumber: number, bounds: FuelLoadBounds): FuelLoad => {
    if (lapNumber <= bounds.heavyEndLap) return 'heavy';
    if (lapNumber <= bounds.mediumEndLap) return 'medium';
    return 'low';
};

export const getCompoundOptions = (driverEntries: SessionDriverData[]): string[] => {
    const set = new Set<string>();
    driverEntries.forEach(entry => {
        entry.stints.forEach(stint => {
            if (stint.compound) {
                set.add(stint.compound.toUpperCase());
            }
        });
    });
    return Array.from(set);
};
