import {
    fetchMeetingsByKey,
    fetchMeetingsByYear,
    fetchSessionsByMeeting,
} from '../api/openf1';
import type { Meeting, Session } from '../types';
import { withServiceError } from './utils';

export function getMeetingsByYear(year: number): Promise<Meeting[]> {
    return withServiceError(
        `Failed to fetch meetings for year ${year}`,
        () => fetchMeetingsByYear(year)
    );
}

export async function getMeetingByKey(meetingKey: number): Promise<Meeting | null> {
    const meetings = await withServiceError(
        `Failed to fetch meeting ${meetingKey}`,
        () => fetchMeetingsByKey(meetingKey)
    );
    return meetings[0] ?? null;
}

export function getSessionsByMeeting(meetingKey: number): Promise<Session[]> {
    return withServiceError(
        `Failed to fetch sessions for meeting ${meetingKey}`,
        () => fetchSessionsByMeeting(meetingKey)
    );
}

export async function getQualifyingSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Qualifying') || null;
}

export async function getRaceSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Race') || null;
}

export async function getSprintSession(meetingKey: number): Promise<Session | null> {
    const sessions = await getSessionsByMeeting(meetingKey);
    return sessions.find(s => s.session_name === 'Sprint') || null;
}
