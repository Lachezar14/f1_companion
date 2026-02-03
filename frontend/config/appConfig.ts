export const CURRENT_YEAR = 2026;

export const DEFAULT_SEASON_YEAR = CURRENT_YEAR;
export const DEFAULT_MEETING_YEAR = CURRENT_YEAR;

export const AVAILABLE_MEETING_YEARS = Array.from({ length: 4 }, (_, index) => CURRENT_YEAR - index);
