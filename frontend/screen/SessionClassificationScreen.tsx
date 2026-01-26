import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
    getSessionResults,
    getDrivers,
    getLapsBySession,
} from '../../backend/api/openf1';
import {SessionResult, Driver, Lap, Row} from '../../backend/types';

export default function SessionClassificationScreen() {
    const route = useRoute<any>();
    const { sessionKey, sessionName } = route.params;

    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClassification();
    }, []);

    const fetchClassification = async () => {
        try {
            setLoading(true);

            // --- Fetch data from API ---
            const [resultsRes, driversRes, lapsRes] = await Promise.all([
                getSessionResults(sessionKey),
                getDrivers(sessionKey),
                getLapsBySession(sessionKey),
            ]);

            const results: SessionResult[] = resultsRes;
            const drivers: Driver[] = driversRes;
            const laps: Lap[] = lapsRes;

            // --- Driver lookup map ---
            const driverMap = new Map<number, string>();
            drivers.forEach(d => driverMap.set(d.driver_number, d.name_acronym));

            // --- Group laps by driver ---
            const lapsByDriver = new Map<number, Lap[]>();
            laps.forEach(lap => {
                if (!lapsByDriver.has(lap.driver_number)) {
                    lapsByDriver.set(lap.driver_number, []);
                }
                lapsByDriver.get(lap.driver_number)!.push(lap);
            });

            // --- Build classification rows ---
            let prevGap: number | null = null;
            const classification: Row[] = results
                .sort((a, b) => a.position - b.position)
                .map(res => {
                    const driverLaps = (lapsByDriver.get(res.driver_number) || []).filter(
                        l => l.lap_duration != null
                    );

                    const fastestLap = driverLaps.reduce<number | null>(
                        (best, l) =>
                            best === null || (l.lap_duration! < best) ? l.lap_duration! : best,
                        null
                    );

                    const lastLap = driverLaps.length
                        ? driverLaps[driverLaps.length - 1].lap_duration
                        : null;

                    const bestS1 = driverLaps.reduce<number | null>(
                        (best, l) =>
                            l.duration_sector_1 != null && (best == null || l.duration_sector_1 < best)
                                ? l.duration_sector_1
                                : best,
                        null
                    );

                    const bestS2 = driverLaps.reduce<number | null>(
                        (best, l) =>
                            l.duration_sector_2 != null && (best == null || l.duration_sector_2 < best)
                                ? l.duration_sector_2
                                : best,
                        null
                    );

                    const bestS3 = driverLaps.reduce<number | null>(
                        (best, l) =>
                            l.duration_sector_3 != null && (best == null || l.duration_sector_3 < best)
                                ? l.duration_sector_3
                                : best,
                        null
                    );

                    let gap = '—';
                    let interval = '—';

                    if (typeof res.gap_to_leader === 'number') {
                        gap = `+${res.gap_to_leader.toFixed(3)}`;
                        if (prevGap != null) {
                            interval = `+${(res.gap_to_leader - prevGap).toFixed(3)}`;
                        }
                        prevGap = res.gap_to_leader;
                    } else if (typeof res.gap_to_leader === 'string') {
                        gap = res.gap_to_leader;
                        interval = res.gap_to_leader;
                        prevGap = null;
                    } else {
                        prevGap = 0;
                    }

                    return {
                        position: res.position,
                        driver: driverMap.get(res.driver_number) ?? res.driver_number.toString(),
                        laps: res.number_of_laps,
                        fastestLap,
                        lastLap,
                        bestS1,
                        bestS2,
                        bestS3,
                        gap,
                        interval,
                    };
                });

            setRows(classification);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderRow = ({ item }: { item: Row }) => (
        <View style={styles.row}>
            <Text style={styles.pos}>{item.position}</Text>
            <Text style={styles.driver}>{item.driver}</Text>
            <Text style={styles.cell}>{item.fastestLap?.toFixed(3) ?? '—'}</Text>
            <Text style={styles.cell}>{item.lastLap?.toFixed(3) ?? '—'}</Text>
            <Text style={styles.cell}>{item.laps}</Text>
            <Text style={styles.cell}>{item.interval}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <Text>Loading classification…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{sessionName}</Text>
            <FlatList
                data={rows}
                keyExtractor={(item, index) => `${item.position}-${index}`}
                renderItem={renderRow}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },

    row: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: '#eee',
        alignItems: 'center',
    },
    pos: { width: 30, fontWeight: 'bold' },
    driver: { width: 50, fontWeight: 'bold' },
    cell: { width: 80, fontSize: 12 },
});
