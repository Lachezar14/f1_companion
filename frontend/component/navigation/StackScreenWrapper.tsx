import React from 'react';
import { View, StyleSheet } from 'react-native';
import StackToolbar from './StackToolbar';
import { semanticColors } from '../../theme/tokens';

interface StackScreenWrapperProps {
    title?: string;
    children: React.ReactNode;
}

const StackScreenWrapper: React.FC<StackScreenWrapperProps> = ({ title, children }) => {
    return (
        <View style={styles.wrapper}>
            <StackToolbar title={title} />
            <View style={styles.content}>{children}</View>
        </View>
    );
};

export default StackScreenWrapper;

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    content: {
        flex: 1,
    },
});
