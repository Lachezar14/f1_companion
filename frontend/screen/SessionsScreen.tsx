import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getMeetingsByYear } from "../../backend/api/openf1";
import { Meeting } from "../../backend/types";

export default function SessionsScreen() {
    const [gps, setGps] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigation = useNavigation();

    useEffect(() => {
        fetchGPs();
    }, []);

    const fetchGPs = async () => {
        try {
            setLoading(true);
            const res = await getMeetingsByYear(2025);
            setGps(res);
        } catch {
            setError('Failed to load GPs');
        } finally {
            setLoading(false);
        }
    };

    const renderGP = ({ item }: { item: Meeting }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('SessionDetails', { gpKey: item.meeting_key })}
        >
            <Text style={styles.name}>{item.meeting_name}</Text>
            <Text style={styles.details}>{item.circuit_short_name} · {item.country_name}</Text>
            <Text style={styles.date}>{new Date(item.date_start).toLocaleDateString()}</Text>
        </TouchableOpacity>
    );

    if (loading) return <View style={styles.center}><Text>Loading GPs…</Text></View>;
    if (error) return <View style={styles.center}><Text>{error}</Text></View>;

    return (
        <View style={styles.container}>
            <FlatList
                data={gps}
                keyExtractor={(item) => item.meeting_key.toString()}
                renderItem={renderGP}
                contentContainerStyle={{ padding: 16 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F2' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    name: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    details: { fontSize: 14, color: '#555', marginBottom: 4 },
    date: { fontSize: 12, color: '#888' },
});
