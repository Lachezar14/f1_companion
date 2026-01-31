import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { fetchMeetingsByYear } from "../../backend/api/openf1";
import { Meeting } from "../../backend/types";
import GPCard from "../component/gp/GPCard";

export default function SessionsScreen() {
    const [gps, setGps] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchGPs();
    }, []);

    const fetchGPs = async () => {
        try {
            setLoading(true);
            const res = await fetchMeetingsByYear(2025);
            setGps(res);
        } catch {
            setError('Failed to load GPs');
        } finally {
            setLoading(false);
        }
    };

    const renderGP = ({ item }: { item: Meeting }) => (
        <GPCard meeting={item} />
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>Loading GPs…</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

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
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#333',
    },
    errorText: {
        fontSize: 16,
        color: '#FF3B30',
    },
});