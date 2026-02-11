const DEFAULT_COMPOUND_COLOR = '#666';

type CompoundDetail = {
    name: string;
    letter: string;
    color: string;
};

const COMPOUND_DETAILS: Record<string, CompoundDetail> = {
    soft: {
        name: 'Soft',
        letter: 'S',
        color: '#E10600',
    },
    medium: {
        name: 'Medium',
        letter: 'M',
        color: '#D8B031',
    },
    hard: {
        name: 'Hard',
        letter: 'H',
        color: '#9E9E9E',
    },
    intermediate: {
        name: 'Interns',
        letter: 'I',
        color: '#4CAF50',
    },
    wet: {
        name: 'Wets',
        letter: 'W',
        color: '#2196F3',
    },
};

const normalizeCompound = (compound?: string | null): string =>
    compound?.trim().toLowerCase() ?? '';

const titleCase = (value: string): string => {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const getCompoundDetail = (compound?: string | null): CompoundDetail | null => {
    const normalized = normalizeCompound(compound);
    if (!normalized) {
        return null;
    }
    return COMPOUND_DETAILS[normalized] ?? null;
};

export const getCompoundColor = (compound?: string | null): string => {
    const detail = getCompoundDetail(compound);
    if (detail) {
        return detail.color;
    }
    return DEFAULT_COMPOUND_COLOR;
};

export const getCompoundLetter = (compound?: string | null): string => {
    const detail = getCompoundDetail(compound);
    if (detail) {
        return detail.letter;
    }
    const normalized = normalizeCompound(compound);
    if (!normalized) {
        return '?';
    }
    return normalized.charAt(0).toUpperCase();
};

export const getCompoundName = (compound?: string | null): string => {
    const detail = getCompoundDetail(compound);
    if (detail) {
        return detail.name;
    }
    const normalized = normalizeCompound(compound);
    if (!normalized) {
        return 'Unknown';
    }
    return titleCase(normalized);
};

export const getTyreStatus = (age: number): string => {
    if (age <= 0) {
        return 'New set';
    }
    return age === 1 ? '1 lap old' : `${age} laps old`;
};
