export * from './meetingsService';
export * from './driversService';
export * from './sessionDataService';
export * from './raceControlService';
export * from './sessionDetailService';

// Legacy helpers retained for reference. Uncomment and move to the appropriate module if needed again.
/*
export async function getPracticeSessions(meetingKey: number): Promise<Session[]> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.filter(s => s.session_name.includes('Practice'));
}

export async function getQualifyingSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const qualiSession = await getQualifyingSession(meetingKey);
    if (!qualiSession) {
        console.log(`[SERVICE] No qualifying session found for meeting ${meetingKey}`);
        return null;
    }
    return getSessionResults(qualiSession.session_key);
}

export async function getRaceSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const raceSession = await getRaceSession(meetingKey);
    if (!raceSession) {
        console.log(`[SERVICE] No race session found for meeting ${meetingKey}`);
        return null;
    }
    return getSessionResults(raceSession.session_key);
}

export async function getSprintSessionResults(meetingKey: number): Promise<SessionResult[] | null> {
    const sprintSession = await getSprintSession(meetingKey);
    if (!sprintSession) {
        console.log(`[SERVICE] No sprint session found for meeting ${meetingKey}`);
        return null;
    }
    return getSessionResults(sprintSession.session_key);
}

export async function getFastestLapInSession(sessionKey: number): Promise<{ lap: Lap; driver: Driver } | null> {
    const [laps, drivers] = await Promise.all([
        getLapsBySession(sessionKey),
        getDriversBySession(sessionKey),
    ]);
    const validLaps = laps.filter(lap => lap.lap_duration != null && lap.lap_duration > 0);
    if (!validLaps.length) return null;
    const fastestLap = validLaps.reduce((fastest, current) =>
        current.lap_duration! < fastest.lap_duration! ? current : fastest
    );
    const driver = drivers.find(d => d.driver_number === fastestLap.driver_number);
    if (!driver) return null;
    return { lap: fastestLap, driver };
}

export function getQualifyingClassification(
    sessionKey: number
): Promise<QualifyingDriverClassification[]> {
    return withServiceError(
        `Failed to build qualifying classification for session ${sessionKey}`,
        async () => {
            const [results, drivers] = await Promise.all([
                getSessionResults(sessionKey),
                getDriversBySession(sessionKey),
            ]);
            return buildQualifyingClassificationFromData(results, drivers, sessionKey);
        }
    );
}

export function getRaceClassification(
    sessionKey: number
): Promise<RaceDriverClassification[]> {
    return withServiceError(
        `Failed to build race classification for session ${sessionKey}`,
        async () => {
            const [results, drivers] = await Promise.all([
                getSessionResults(sessionKey),
                getDriversBySession(sessionKey),
            ]);

            let startingGrid: StartingGrid[] = [];
            let stints: Stint[] = [];

            try {
                startingGrid = await fetchStartingGridBySession(sessionKey);
            } catch (error) {
                console.warn(
                    `[SERVICE] Starting grid unavailable for session ${sessionKey}:`,
                    error
                );
            }

            try {
                stints = await getStintsBySession(sessionKey);
            } catch (error) {
                console.warn(`[SERVICE] Stints unavailable for session ${sessionKey}:`, error);
            }

            return buildRaceClassificationFromData(results, drivers, startingGrid, stints, sessionKey);
        }
    );
}
*/
