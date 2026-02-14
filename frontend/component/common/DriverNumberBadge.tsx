import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { getTeamColorHex } from '../../../utils/driver';
import { semanticColors, typography } from '../../theme/tokens';

type DriverNumberBadgeProps = {
    driverNumber: number;
    teamColor?: string | null;
    size?: number;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};

export default function DriverNumberBadge({
    driverNumber,
    teamColor,
    size = 34,
    style,
    textStyle,
}: DriverNumberBadgeProps) {
    return (
        <View
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: getTeamColorHex(teamColor, semanticColors.textPrimary),
                },
                style,
            ]}
        >
            <Text
                style={[
                    styles.text,
                    {
                        fontSize: Math.max(Math.floor(size * 0.38), typography.size.sm),
                    },
                    textStyle,
                ]}
            >
                {driverNumber}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
    },
});

