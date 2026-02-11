import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    StyleProp,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { getCompoundColor, getCompoundLetter } from '../../../utils/tyre';

type TyreCompoundBadgeProps = {
    compound?: string | null;
    size?: number;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};

export default function TyreCompoundBadge({
    compound,
    size = 46,
    style,
    textStyle,
}: TyreCompoundBadgeProps) {
    const compoundColor = getCompoundColor(compound);
    const compoundLetter = getCompoundLetter(compound);
    const innerSize = Math.max(size * 0.65, 20);
    const hubSize = Math.max(size * 0.28, 8);
    const letterSize = Math.max(size * 0.33, 12);

    return (
        <View
            style={[
                styles.outer,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: compoundColor,
                },
                style,
            ]}
        >
            <View
                style={[
                    styles.inner,
                    {
                        width: innerSize,
                        height: innerSize,
                        borderRadius: innerSize / 2,
                    },
                ]}
            >
                <View
                    style={[
                        styles.hub,
                        {
                            width: hubSize,
                            height: hubSize,
                            borderRadius: hubSize / 2,
                        },
                    ]}
                />
            </View>
            <Text style={[styles.letter, { color: compoundColor, fontSize: letterSize }, textStyle]}>
                {compoundLetter}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        backgroundColor: '#060607',
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
    },
    inner: {
        backgroundColor: '#0D0F13',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hub: {
        backgroundColor: '#2B2F3A',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    letter: {
        position: 'absolute',
        fontWeight: '800',
        letterSpacing: 1,
    },
});
