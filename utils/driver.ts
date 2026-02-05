import type { SessionResult } from '../backend/types';
import { formatLapTime } from '../shared/time';

const DEFAULT_TEAM_COLOR = '#15151E';

export const getTeamColorHex = (teamColor?: string | null, fallback = DEFAULT_TEAM_COLOR): string => {
    if (!teamColor || !teamColor.trim()) {
        return fallback;
    }
    return teamColor.startsWith('#') ? teamColor : `#${teamColor}`;
};

export const getDriverInitials = (name: string, maxLength = 2): string => {
    const parts = name.trim().split(/\s+/);
    if (!parts.length) {
        return '?';
    }
    return (
        parts
            .map(part => part[0]?.toUpperCase() ?? '')
            .join('')
            .slice(0, maxLength) || '?'
    );
};

export const deriveDriverCode = (fullName: string, fallbackLength = 3): string => {
    const parts = fullName.trim().split(' ');
    const target = (parts[parts.length - 1] || fullName).replace(/[^A-Za-z]/g, '');
    const upper = target.toUpperCase();

    if (upper.length >= fallbackLength) {
        return upper.slice(0, fallbackLength);
    }

    if (upper.length === 0 && fullName) {
        return fullName.slice(0, fallbackLength).toUpperCase();
    }

    const lastChar = upper.charAt(upper.length - 1) || fullName.charAt(0).toUpperCase() || 'X';
    return upper.padEnd(fallbackLength, lastChar);
};

export const formatSessionGap = (gap: SessionResult['gap_to_leader']): string => {
    if (gap === null || gap === undefined) {
        return '—';
    }
    if (typeof gap === 'string') {
        return gap.toUpperCase();
    }
    if (typeof gap === 'number') {
        return `+${gap.toFixed(3)}s`;
    }
    if (Array.isArray(gap)) {
        const numericGap = gap.find(value => typeof value === 'number') as number | undefined;
        if (typeof numericGap === 'number') {
            return `+${numericGap.toFixed(3)}s`;
        }
    }
    return '—';
};

export const formatSessionResult = (result?: SessionResult | null, fallback = '—'): string => {
    if (!result) {
        return fallback;
    }
    if (result.dsq) return 'DSQ';
    if (result.dnf) return 'DNF';
    if (result.dns) return 'DNS';
    if (result.position) return `P${result.position}`;
    return fallback;
};

export const getResultStatusLabel = (result?: SessionResult | null, defaultLabel = 'Race Result'): string => {
    if (!result) {
        return defaultLabel;
    }
    if (result.dsq) return 'Disqualified';
    if (result.dnf) return 'Did Not Finish';
    if (result.dns) return 'Did Not Start';
    return 'Classified';
};

export const formatSessionDuration = (duration?: SessionResult['duration']): string => {
    if (duration === null || duration === undefined) {
        return '—';
    }
    if (typeof duration === 'number') {
        return formatLapTime(duration);
    }
    if (typeof duration === 'string') {
        return duration;
    }
    if (Array.isArray(duration)) {
        const val = duration[duration.length - 1];
        if (typeof val === 'number') {
            return formatLapTime(val);
        }
    }
    return '—';
};

type PositionContext = {
    position?: number | null;
    statusText?: string | null;
    dnf?: boolean;
    dns?: boolean;
    dsq?: boolean;
    prefix?: string;
    fallback?: string;
};

export const formatDriverPosition = ({
    position,
    statusText,
    dnf,
    dns,
    dsq,
    prefix = 'P',
    fallback = '-',
}: PositionContext): string => {
    if (dns) return 'DNS';
    if (dnf) return 'DNF';
    if (dsq) return 'DSQ';

    if (typeof position === 'number' && position > 0) {
        return `${prefix}${position}`;
    }

    if (statusText) {
        return statusText.toUpperCase();
    }

    return fallback;
};

export const getDriverPositionColor = ({
    position,
    dnf,
    dns,
    dsq,
}: PositionContext): string => {
    if (dnf || dns || dsq) {
        return '#999';
    }
    if (position === 1) return '#FFD700';
    if (position === 2) return '#C0C0C0';
    if (position === 3) return '#CD7F32';
    return '#15151E';
};

