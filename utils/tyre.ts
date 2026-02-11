const DEFAULT_COMPOUND_COLOR = '#666';

const normalizeCompound = (compound?: string | null): string =>
    compound?.trim().toLowerCase() ?? '';

export const getCompoundColor = (compound?: string | null): string => {
    const compoundLower = normalizeCompound(compound);
    if (!compoundLower) {
        return DEFAULT_COMPOUND_COLOR;
    }
    switch (compoundLower) {
        case 'soft':
            return '#E10600';
        case 'medium':
            return '#d8b031';
        case 'hard':
            return '#9E9E9E';
        case 'intermediate':
            return '#4CAF50';
        case 'wet':
            return '#2196F3';
        default:
            return DEFAULT_COMPOUND_COLOR;
    }
};

export const getCompoundLetter = (compound?: string | null): string => {
    const compoundLower = normalizeCompound(compound);
    if (!compoundLower) {
        return '?';
    }
    switch (compoundLower) {
        case 'soft':
            return 'S';
        case 'medium':
            return 'M';
        case 'hard':
            return 'H';
        case 'intermediate':
            return 'I';
        case 'wet':
            return 'W';
        default:
            return compoundLower.charAt(0).toUpperCase();
    }
};

export const getTyreStatus = (age: number): string => {
    if (age <= 0) {
        return 'New set';
    }
    return age === 1 ? '1 lap old' : `${age} laps old`;
};
