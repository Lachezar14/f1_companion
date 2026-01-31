export type Meeting = {
    meeting_key: number;
    meeting_name: string;
    meeting_official_name: string;

    circuit_key: number;
    circuit_short_name: string;
    circuit_type: string;
    circuit_info_url: string;
    circuit_image: string;

    location: string;

    country_key: number;
    country_code: string;
    country_name: string;
    country_flag: string;

    date_start: string; // ISO
    date_end: string;   // ISO
    gmt_offset: string;

    year: number;
};

export type Session = {
    session_key: number;
    session_name: string;
    session_type: string;

    meeting_key: number;

    circuit_key: number;
    circuit_short_name: string;

    location: string;

    country_key: number;
    country_code: string;
    country_name: string;

    date_start: string; // ISO
    date_end: string;   // ISO
    gmt_offset: string;

    year: number;
};

export type SessionResult = {
    position: number | null;

    driver_number: number;

    duration: number | number[];
    // race: total time (seconds)
    // quali: [Q1, Q2, Q3]

    gap_to_leader: number | string | number[] | null;
    // number → seconds
    // "+1 LAP"
    // array for quali

    number_of_laps: number;

    dnf: boolean;
    dns: boolean;
    dsq: boolean;

    meeting_key: number;
    session_key: number;
};

export type Driver = {
    driver_number: number;

    broadcast_name: string;
    first_name: string;
    last_name: string;
    full_name: string;

    name_acronym: string;

    team_name: string;
    team_colour: string;

    headshot_url: string;

    meeting_key: number;
    session_key: number;
};

export type Lap = {
    date_start: string;

    driver_number: number;

    lap_number: number;

    lap_duration: number | null;

    duration_sector_1: number | null;
    duration_sector_2: number | null;
    duration_sector_3: number | null;

    segments_sector_1: number[];
    segments_sector_2: number[];
    segments_sector_3: number[];

    i1_speed: number | null;
    i2_speed: number | null;
    st_speed: number | null;

    is_pit_out_lap: boolean;

    meeting_key: number;
    session_key: number;
};

export type Row = {
    position: number | null;
    driver: string;
    laps: number;
    fastestLap: number | null;
    lastLap: number | null;
    bestS1: number | null;
    bestS2: number | null;
    bestS3: number | null;
    gap: string;
    interval: string;
};

export interface Stint {
    compound: string;
    driver_number: number;
    lap_end: number;
    lap_start: number;
    meeting_key: number;
    session_key: number;
    stint_number: number;
    tyre_age_at_start: number;
}

export interface StartingGrid {
    position: number;
    driver_number: number;
    lap_duration: number;
    meeting_key: number;
    session_key: number;
}

export type QualifyingDriverClassification = {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    teamColor?: string;
    q1: string | null;
    q2: string | null;
    q3: string | null;
    best: string | null;
    gapToPole: string | null;
    status: string | null;
};

export type RaceDriverClassification = {
    position: number | null;
    driverNumber: number;
    driverName: string;
    teamName: string;
    teamColor?: string;
    gridPosition: number | null;
    laps: number;
    totalTime: string | null;
    gapToLeader: string | null;
    pitStops: number | null;
    status: string;
};

export type DriverSeasonStats = {
    season: number;
    driver: {
        number: number;
        name: string;
        team: string;
        teamColor?: string;
        headshotUrl?: string;
    };
    totals: {
        wins: number;
        podiums: number;
        races: number;
        averageRacePosition: number | null;
        averageQualifyingPosition: number | null;
        bestRaceResult: number | null;
        bestQualifyingResult: number | null;
        qualifyingSessions: number;
    };
};

export type DriverSeasonContext = {
    name?: string;
    team?: string;
    teamColor?: string;
    headshotUrl?: string;
};
