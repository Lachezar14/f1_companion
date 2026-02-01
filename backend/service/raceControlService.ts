import { fetchRaceControlBySession } from '../api/openf1';
import type { RaceControl, RaceControlSummary, SafetyCarInterval, SessionResult } from '../types';
import { withServiceError } from './utils';

const SAFETY_CAR_START_KEYWORDS = [
    'deploy',
    'deployed',
    'deployment',
    'enters the track',
    'appears',
    'out on track',
];

const SAFETY_CAR_END_KEYWORDS = [
    'in this lap',
    'returns to the pit',
    'returning to the pits',
    'ending',
    'withdrawn',
    'coming in',
    'finished',
];

const isSafetyCarStartMessage = (message: string | undefined | null): boolean => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return SAFETY_CAR_START_KEYWORDS.some(keyword => lower.includes(keyword));
};

const isSafetyCarEndMessage = (message: string | undefined | null): boolean => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return SAFETY_CAR_END_KEYWORDS.some(keyword => lower.includes(keyword));
};

export function summarizeRaceControl(
    entries: RaceControl[],
    maxLap: number
): RaceControlSummary {
    const intervals: SafetyCarInterval[] = [];
    const safetyMessages = entries
        .filter(entry => entry.category === 'SafetyCar' && typeof entry.lapNumber === 'number')
        .sort((a, b) => (a.lapNumber ?? 0) - (b.lapNumber ?? 0));

    let activeStart: number | null = null;
    safetyMessages.forEach(message => {
        const lap = message.lapNumber ?? 0;
        if (isSafetyCarStartMessage(message.message)) {
            activeStart = lap;
        }

        if (activeStart != null && isSafetyCarEndMessage(message.message)) {
            const endLap = Math.max(lap, activeStart);
            intervals.push({ start: activeStart, end: endLap });
            activeStart = null;
        }
    });

    if (activeStart != null) {
        const finalLap = maxLap > 0 ? maxLap : activeStart;
        intervals.push({ start: activeStart, end: finalLap });
    }

    const lapSet = new Set<number>();
    intervals.forEach(({ start, end }) => {
        for (let lap = start; lap <= end; lap++) {
            lapSet.add(lap);
        }
    });

    return {
        safetyCarIntervals: intervals,
        safetyCarLaps: Array.from(lapSet).sort((a, b) => a - b),
    };
}

type RaceControlApiResponse = {
    category: string;
    date: string;
    driver_number?: number | null;
    flag?: string | null;
    lap_number?: number | null;
    meeting_key: number;
    session_key: number;
    message: string;
    qualifying_phase?: number | null;
    scope?: string | null;
    sector?: number | null;
};

const normalizeRaceControl = (entry: RaceControlApiResponse): RaceControl => ({
    category: entry.category,
    date: entry.date,
    driverNumber: entry.driver_number ?? null,
    flag: entry.flag ?? null,
    lapNumber: entry.lap_number ?? null,
    meetingKey: entry.meeting_key,
    sessionKey: entry.session_key,
    message: entry.message,
    qualifyingPhase: entry.qualifying_phase ?? null,
    scope: entry.scope ?? null,
    sector: entry.sector ?? null,
});

export function getRaceControlBySession(sessionKey: number): Promise<RaceControl[]> {
    return withServiceError(
        `Failed to fetch race control for session ${sessionKey}`,
        async () => {
            const raw = await fetchRaceControlBySession(sessionKey);
            return raw.map(normalizeRaceControl);
        }
    );
}

export const getMaxLapCount = (results: SessionResult[]): number =>
    results.reduce((max, entry) => Math.max(max, entry.number_of_laps ?? 0), 0);
