export function formatRaceTime(seconds: number | null | undefined): string {
    if (seconds == null) {
        return '-';
    }

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hh = hrs.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

export function formatLapTime(seconds: number | null | undefined): string {
    if (seconds == null) {
        return '-';
    }

    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);

    return `${minutes}:${secs.padStart(6, '0')}`;
}
