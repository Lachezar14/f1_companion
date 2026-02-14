import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { Session } from '../backend/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type SessionTheme = {
    icon: IoniconName;
    accent: string;
    tint: string;
};

const SESSION_THEMES: Record<'practice' | 'qualifying' | 'sprint' | 'race' | 'default', SessionTheme> = {
    practice: { icon: 'speedometer', accent: '#3EC5FF', tint: 'rgba(62,197,255,0.15)' },
    qualifying: { icon: 'stopwatch', accent: '#FF8A5C', tint: 'rgba(255,138,92,0.15)' },
    sprint: { icon: 'flag', accent: '#AC8CFF', tint: 'rgba(172,140,255,0.15)' },
    race: { icon: 'trophy', accent: '#6DE19C', tint: 'rgba(109,225,156,0.15)' },
    default: { icon: 'document-text', accent: '#9BA3AE', tint: 'rgba(155,163,174,0.15)' },
};

export const resolveSessionTheme = (sessionName: string): SessionTheme => {
    const name = sessionName.toLowerCase();
    if (name.includes('practice')) return SESSION_THEMES.practice;
    if (name.includes('qualifying') || name.includes('shootout')) return SESSION_THEMES.qualifying;
    if (name.includes('sprint')) return SESSION_THEMES.sprint;
    if (name.includes('race')) return SESSION_THEMES.race;
    return SESSION_THEMES.default;
};

export const formatSessionDateTime = (session: Session): string => {
    const date = new Date(session.date_start);
    return `${date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })}${session.gmt_offset ? ` · ${session.gmt_offset}` : ''}`;
};
