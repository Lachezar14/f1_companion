import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getSessionsByMeeting } from "../../backend/api/openf1";
import { Session } from "../../backend/types";

export default function GPSessionsScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { gpKey } = route.params;

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (gpKey) fetchSessions();
    }, [gpKey]);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await getSessionsByMeeting(gpKey);
            setSessions(res);
        } catch {
            setError('Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    const renderSession = ({ item }: { item: Session }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                navigation.navigate('SessionClassification', {
                    sessionKey: item.session_key,
                    sessionName: item.session_name,
                })
            }
        >
            <Text style={styles.name}>{item.session_name}</Text>
            <Text style={styles.date}>
                {new Date(item.date_start).toLocaleString()}
            </Text>
        </TouchableOpacity>
    );

    if (loading) return <View style={styles.center}><Text>Loading sessions…</Text></View>;
    if (error) return <View style={styles.center}><Text>{error}</Text></View>;

    return (
        <View style={styles.container}>
            <FlatList
                data={sessions}
                keyExtractor={(item) => item.session_key.toString()}
                renderItem={renderSession}
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
        elevation: 3,
    },
    name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    date: { fontSize: 12, color: '#888' },
});
