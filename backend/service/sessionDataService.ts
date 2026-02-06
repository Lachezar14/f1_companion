import {
    fetchLapsByDriverAndSession,
    fetchLapsBySession,
    fetchSessionResults,
    fetchSessionResultsByDriver,
    fetchStintsByDriverAndSession,
    fetchStintsBySession,
    fetchCarDataByDriverAndSession,
    fetchOvertakesBySession,
} from '../api/openf1';
import type { Lap, SessionResult, Stint, Overtake } from '../types';
import { withServiceError } from './utils';

export function getSessionResults(sessionKey: number): Promise<SessionResult[]> {
    return withServiceError(
        `Failed to fetch session results for session ${sessionKey}`,
        () => fetchSessionResults(sessionKey)
    );
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
