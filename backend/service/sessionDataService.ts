import {
    fetchLapsByDriverAndSession,
    fetchLapsBySession,
    fetchSessionResults,
    fetchSessionResultsByDriver,
    fetchStintsByDriverAndSession,
    fetchStintsBySession,
    fetchCarDataByDriverAndSession,
    fetchOvertakesBySession,
    fetchSessionPits,
    fetchStartingGridByMeeting,
} from '../api/openf1';
import type { Lap, SessionResult, Stint, Overtake, PitStop, StartingGrid } from '../types';
import { withServiceError } from './utils';

const sessionResultsCache = new Map<number, SessionResult[]>();
const sessionResultsInflight = new Map<number, Promise<SessionResult[]>>();
const pitStopsCache = new Map<number, PitStop[]>();
const pitStopsInflight = new Map<number, Promise<PitStop[]>>();

export function getSessionResults(sessionKey: number): Promise<SessionResult[]> {
    if (sessionResultsCache.has(sessionKey)) {
        return Promise.resolve(sessionResultsCache.get(sessionKey)!);
    }

    if (sessionResultsInflight.has(sessionKey)) {
        return sessionResultsInflight.get(sessionKey)!;
    }

    const request = withServiceError(
        `Failed to fetch session results for session ${sessionKey}`,
        async () => {
            const results = await fetchSessionResults(sessionKey);
            sessionResultsCache.set(sessionKey, results);
            return results;
        }
    ).finally(() => {
        sessionResultsInflight.delete(sessionKey);
    });

    sessionResultsInflight.set(sessionKey, request);
    return request;
}

export function getSessionResultsByDriver(driverNumber: number): Promise<SessionResult[]> {
    return withServiceError(
        `Failed to fetch session results for driver ${driverNumber}`,
        () => fetchSessionResultsByDriver(driverNumber)
    );
}

export async function getDriverSessionResult(
    sessionKey: number,
    driverNumber: number
): Promise<SessionResult | null> {
    const sessionResults = await getSessionResults(sessionKey);
    return sessionResults.find(s => s.driver_number === driverNumber) || null;
}

export function getLapsBySession(sessionKey: number): Promise<Lap[]> {
    return withServiceError(
        `Failed to fetch laps for session ${sessionKey}`,
        () => fetchLapsBySession(sessionKey)
    );
}

export function getLapsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Lap[]> {
    return withServiceError(
        `Failed to fetch laps for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchLapsByDriverAndSession(sessionKey, driverNumber)
    );
}

export function getStintsBySession(sessionKey: number): Promise<Stint[]> {
    return withServiceError(
        `Failed to fetch stints for session ${sessionKey}`,
        () => fetchStintsBySession(sessionKey)
    );
}

export function getStintsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<Stint[]> {
    return withServiceError(
        `Failed to fetch stints for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchStintsByDriverAndSession(sessionKey, driverNumber)
    );
}

export function getCarDataByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<any[]> {
    return withServiceError(
        `Failed to fetch car data for driver ${driverNumber} in session ${sessionKey}`,
        () => fetchCarDataByDriverAndSession(sessionKey, driverNumber)
    );
}

export function getOvertakesBySession(sessionKey: number): Promise<Overtake[]> {
    return withServiceError(
        `Failed to fetch overtakes for session ${sessionKey}`,
        () => fetchOvertakesBySession(sessionKey)
    );
}

export function getPitStopsBySession(sessionKey: number): Promise<PitStop[]> {
    if (pitStopsCache.has(sessionKey)) {
        return Promise.resolve(pitStopsCache.get(sessionKey)!);
    }

    if (pitStopsInflight.has(sessionKey)) {
        return pitStopsInflight.get(sessionKey)!;
    }

    const request = withServiceError(
        `Failed to fetch pit stops for session ${sessionKey}`,
        async () => {
            const stops = await fetchSessionPits(sessionKey);
            pitStopsCache.set(sessionKey, stops);
            return stops;
        }
    ).finally(() => {
        pitStopsInflight.delete(sessionKey);
    });

    pitStopsInflight.set(sessionKey, request);
    return request;
}

export async function getPitStopsByDriverAndSession(
    sessionKey: number,
    driverNumber: number
): Promise<PitStop[]> {
    const pitStops = await getPitStopsBySession(sessionKey);
    return pitStops.filter(stop => stop.driver_number === driverNumber);
}

export function getRaceStartingGrid(meetingKey: number): Promise<StartingGrid[]> {
    return withServiceError(
        `Failed to fetch race starting grid for meeting ${meetingKey}`,
        () => fetchStartingGridByMeeting(meetingKey)
    );
}
