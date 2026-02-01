import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Meeting } from '../../../backend/types';

interface GPCardProps {
    meeting: Meeting;
}

type NavigationProp = NativeStackNavigationProp<any>;

export default function GPCard({ meeting }: GPCardProps) {
    const navigation = useNavigation<NavigationProp>();

    const handlePress = () => {
        navigation.navigate('GPScreen', { gpKey: meeting.meeting_key, year: meeting.year });
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <Image
                    source={{ uri: meeting.country_flag }}
                    style={styles.flag}
                />
                <View style={styles.headerText}>
                    <Text style={styles.name}>{meeting.meeting_name}</Text>
                    <Text style={styles.details}>{meeting.circuit_short_name}</Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <Text style={styles.date}>{meeting.location}</Text>
                <Text style={styles.date}>
                    {new Date(meeting.date_start).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                    })}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    flag: {
        width: 48,
        height: 32,
        borderRadius: 4,
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E10600',
    },
    details: {
        fontSize: 14,
        color: '#555',
        marginTop: 2,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    date: {
        fontSize: 14,
        color: '#888',
    },
});
