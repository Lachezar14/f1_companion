import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Meeting } from '../../../backend/types';

interface GPCardProps {
    meeting: Meeting;
}

type NavigationProp = NativeStackNavigationProp<any>;

const fallbackFlag =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';

export default function GPCard({ meeting }: GPCardProps) {
    const navigation = useNavigation<NavigationProp>();

    const handlePress = () => {
        navigation.navigate('GPScreen', { gpKey: meeting.meeting_key, year: meeting.year });
    };

    const dateLabel = new Date(meeting.date_start).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.88}>
            <ImageBackground
                source={{ uri: meeting.country_flag || fallbackFlag }}
                style={styles.flagPanel}
                imageStyle={styles.flagImage}
            >
                <View style={styles.flagOverlay} />
                <View style={styles.flagContent}>
                    <Text style={styles.countryCode}>{meeting.country_code}</Text>
                    <Text style={styles.countryName} numberOfLines={1}>
                        {meeting.country_name}
                    </Text>
                </View>
            </ImageBackground>

            <View style={styles.cardContent}>
                <View style={styles.tagRow}>
                    {meeting.circuit_short_name ? (
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>{meeting.circuit_short_name}</Text>
                        </View>
                    ) : null}
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{dateLabel}</Text>
                    </View>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                    {meeting.meeting_name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {meeting.location}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: '#161623',
        borderRadius: 24,
        marginBottom: 14,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        minHeight: 110,
    },
    flagPanel: {
        width: 110,
        justifyContent: 'flex-end',
    },
    flagImage: {
        opacity: 0.85,
    },
    flagOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    flagContent: {
        padding: 12,
    },
    countryCode: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 2,
    },
    countryName: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 4,
    },
    cardContent: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 18,
        justifyContent: 'center',
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    tag: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginRight: 8,
        marginBottom: 6,
    },
    tagText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.75)',
    },
});
