import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TyreCompoundBadge from './TyreCompoundBadge';
import { radius, semanticColors, spacing, typography } from '../../theme/tokens';

type StintHeaderProps = {
    stintNumber: number;
    compound?: string | null;
    title: string;
    subtitle?: string;
    meta?: string;
    isNewTyre: boolean;
    tyreStateLabel: string;
    badgeSize?: number;
};

export default function StintHeader({
    stintNumber,
    compound,
    title,
    subtitle,
    meta,
    isNewTyre,
    tyreStateLabel,
    badgeSize = 30,
}: StintHeaderProps) {
    return (
        <View style={styles.header}>
            <Text style={styles.overline}>Stint {stintNumber}</Text>
            <View style={styles.mainRow}>
                <View style={styles.leftBlock}>
                    <View style={styles.titleRow}>
                        <TyreCompoundBadge compound={compound} size={badgeSize} />
                        <Text style={styles.title}>{title}</Text>
                    </View>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
                </View>
                <View
                    style={[
                        styles.tyreStatePill,
                        isNewTyre ? styles.tyreStatePillNew : styles.tyreStatePillUsed,
                    ]}
                >
                    <Text
                        style={[
                            styles.tyreStateText,
                            isNewTyre ? styles.tyreStateTextNew : styles.tyreStateTextUsed,
                        ]}
                    >
                        {tyreStateLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        marginBottom: spacing.xs,
    },
    overline: {
        fontSize: typography.size.xs,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: semanticColors.textMuted,
        fontWeight: typography.weight.bold,
    },
    mainRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    leftBlock: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
        textTransform: 'capitalize',
    },
    subtitle: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    metaText: {
        marginTop: spacing.xxs,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    tyreStatePill: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
    },
    tyreStatePillNew: {
        backgroundColor: 'rgba(31,138,77,0.12)',
        borderColor: 'rgba(31,138,77,0.4)',
    },
    tyreStatePillUsed: {
        backgroundColor: 'rgba(106,111,135,0.12)',
        borderColor: 'rgba(106,111,135,0.35)',
    },
    tyreStateText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        letterSpacing: 0.3,
    },
    tyreStateTextNew: {
        color: semanticColors.success,
    },
    tyreStateTextUsed: {
        color: '#6A6F87',
    },
});

