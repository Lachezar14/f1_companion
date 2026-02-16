import {
    fetchDriverStanding,
    fetchTeamStanding,
} from '../api/openf1';
import type {
    ChampionshipDriver,
    ChampionshipTeam,
    Driver,
    DriverChampionshipStanding,
} from '../types';
import { withServiceError } from './utils';
import { getDriversByMeeting, getDriversBySession } from './driversService';

const isValidKey = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

async function buildDriverLookup(
    standings: ChampionshipDriver[]
): Promise<Map<number, Driver>> {
    const driverMap = new Map<number, Driver>();
    const requiredDrivers = new Set(standings.map(entry => entry.driver_number));
    const targetCount = requiredDrivers.size;

    if (!targetCount) {
        return driverMap;
    }

    const addDrivers = (drivers: Driver[]) => {
        drivers.forEach(driver => {
            if (requiredDrivers.has(driver.driver_number)) {
                driverMap.set(driver.driver_number, driver);
            }
        });
    };

    const sessionKeys = Array.from(
        new Set(
            standings
                .map(entry => entry.session_key)
                .filter(isValidKey)
        )
    ).sort((a, b) => b - a);

    const [latestSessionKey, ...otherSessionKeys] = sessionKeys;
    if (latestSessionKey) {
        try {
            const drivers = await getDriversBySession(latestSessionKey);
            addDrivers(drivers);
        } catch (error) {
            console.warn(
                `[SERVICE] Unable to load drivers for session ${latestSessionKey} when building championship standings`,
                error
            );
        }
    }

    for (const sessionKey of otherSessionKeys) {
        if (driverMap.size === targetCount) break;
        try {
            const drivers = await getDriversBySession(sessionKey);
            addDrivers(drivers);
        } catch (error) {
            console.warn(
                `[SERVICE] Unable to load drivers for session ${sessionKey} when building championship standings`,
                error
            );
        }
    }

    if (driverMap.size === targetCount) {
        return driverMap;
    }

    const meetingKeys = Array.from(
        new Set(
            standings
                .map(entry => entry.meeting_key)
                .filter(isValidKey)
        )
    ).sort((a, b) => b - a);

    const [latestMeetingKey, ...otherMeetingKeys] = meetingKeys;
    if (latestMeetingKey) {
        try {
            const drivers = await getDriversByMeeting(latestMeetingKey);
            addDrivers(drivers);
        } catch (error) {
            console.warn(
                `[SERVICE] Unable to load drivers for meeting ${latestMeetingKey} when building championship standings`,
                error
            );
        }
    }

    for (const meetingKey of otherMeetingKeys) {
        if (driverMap.size === targetCount) break;
        try {
            const drivers = await getDriversByMeeting(meetingKey);
            addDrivers(drivers);
        } catch (error) {
            console.warn(
                `[SERVICE] Unable to load drivers for meeting ${meetingKey} when building championship standings`,
                error
            );
        }
    }

    return driverMap;
}

export async function getDriverChampionshipStandings(): Promise<DriverChampionshipStanding[]> {
    return withServiceError(
        'Failed to fetch driver championship standings',
        async () => {
            const standings = await fetchDriverStanding();
            if (!standings.length) {
                return [];
            }

            const driverLookup = await buildDriverLookup(standings);

            return standings.map(entry => ({
                ...entry,
                driver: driverLookup.get(entry.driver_number) ?? null,
            }));
        }
    );
}

export function getTeamChampionshipStandings(): Promise<ChampionshipTeam[]> {
    return withServiceError(
        'Failed to fetch team championship standings',
        () => fetchTeamStanding()
    );
}
