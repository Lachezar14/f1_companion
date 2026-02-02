import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StackToolbarProps {
    title?: string;
}

const StackToolbar: React.FC<StackToolbarProps> = ({ title }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const canGoBack = navigation.canGoBack();

    if (!canGoBack) {
        return <View style={{ height: insets.top }} />;
    }

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: insets.top + 6,
                },
            ]}
        >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={handleBack}
                activeOpacity={0.85}
                style={styles.backButton}
            >
                <MaterialCommunityIcons name="chevron-left" size={28} color="#0F1215" />
            </TouchableOpacity>
            {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
    );
};

export default StackToolbar;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#F5F5F7',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F1215',
        marginLeft: 12,
    },
});
