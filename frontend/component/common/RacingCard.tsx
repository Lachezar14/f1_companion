import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../theme/tokens';

type RacingCardProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    accentColor?: string;
};

export default function RacingCard({
    children,
    style,
    contentStyle,
    accentColor = colors.brand.primary,
}: RacingCardProps) {
    return (
        <View style={[styles.card, style]}>
            <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />
            <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.neutral.white,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.neutral.lightGray,
        overflow: 'hidden',
        ...shadows.level2,
    },
    accentStripe: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    content: {
        paddingLeft: 16,
    },
});

