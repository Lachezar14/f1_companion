import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PodiumFinisher } from '../../../backend/service/openf1Service';

interface RaceResultSectionProps {
    podium: PodiumFinisher[];
    podiumError: string | null;
    onRetry: () => void;
}

export default function RaceResultSection({ podium, podiumError, onRetry }: RaceResultSectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Race Result</Text>
            {podiumError ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{podiumError}</Text>
                    <TouchableOpacity
                        onPress={onRetry}
                        style={styles.errorBoxButton}
                    >
                        <Text style={styles.errorBoxButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : podium.length > 0 ? (
                podium.map(p => (
                    <View
                        key={p.position}
                        style={[
                            styles.podiumCard,
                            p.position === 1 && styles.podiumCardFirst,
                        ]}
                    >
                        <View style={styles.podiumPosition}>
                            <Text style={styles.positionNumber}>
                                {p.position}
                            </Text>
                            {p.position === 1 && (
                                <Text style={styles.positionEmoji}>🥇</Text>
                            )}
                            {p.position === 2 && (
                                <Text style={styles.positionEmoji}>🥈</Text>
                            )}
                            {p.position === 3 && (
                                <Text style={styles.positionEmoji}>🥉</Text>
                            )}
                        </View>
                        <View style={styles.podiumInfo}>
                            <Text style={styles.podiumDriver}>{p.driver}</Text>
                            <Text style={styles.podiumConstructor}>
                                {p.constructor}
                            </Text>
                            {p.time && (
                                <Text style={styles.podiumTime}>
                                    {p.position === 1 ? '⏱️ ' : '+'}{p.time}
                                </Text>
                            )}
                        </View>
                    </View>
                ))
            ) : (
                <Text style={styles.noData}>Race data not yet available</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        backgroundColor: '#FFF',
        padding: 16,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 12,
    },
    noData: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
    errorBox: {
        backgroundColor: '#FFE6E6',
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E10600',
    },
    errorBoxText: {
        fontSize: 14,
        color: '#C00',
        marginBottom: 12,
    },
    errorBoxButton: {
        backgroundColor: '#E10600',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    errorBoxButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    podiumCard: {
        flexDirection: 'row',
        backgroundColor: '#F8F8F8',
        padding: 14,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: 'center',
    },
    podiumCardFirst: {
        backgroundColor: '#FFF9E6',
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    podiumPosition: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        minWidth: 50,
    },
    positionNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15151E',
        marginRight: 4,
    },
    positionEmoji: {
        fontSize: 20,
    },
    podiumInfo: {
        flex: 1,
    },
    podiumDriver: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15151E',
        marginBottom: 2,
    },
    podiumConstructor: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    podiumTime: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E10600',
    },
});