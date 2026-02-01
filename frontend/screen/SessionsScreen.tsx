import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { getMeetingsByYear } from '../../backend/service/openf1Service';
import { Meeting } from "../../backend/types";
import GPCard from "../component/gp/GPCard";
import { DEFAULT_MEETING_YEAR } from '../config/appConfig';
import { useServiceRequest } from '../hooks/useServiceRequest';

export default function SessionsScreen() {
    const seasonYear = DEFAULT_MEETING_YEAR;
    const {
        data,
        loading,
        error,
        reload,
    } = useServiceRequest<Meeting[]>(() => getMeetingsByYear(seasonYear), [seasonYear]);

    const gps = data ?? [];

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
                <TouchableOpacity style={styles.retryButton} onPress={reload}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
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
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#E10600',
        borderRadius: 8,
    },
    retryText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
});
