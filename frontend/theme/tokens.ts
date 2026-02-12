export const colors = {
    brand: {
        primary: '#E10600',
        primaryDark: '#B00500',
    },
    podium: {
        gold: '#FFD700',
        silver: '#C0C0C0',
        bronze: '#CD7F32',
    },
    compounds: {
        soft: '#E10600',
        medium: '#FFD700',
        hard: '#FFFFFF',
        intermediate: '#00A650',
        wet: '#0066CC',
    },
    flags: {
        green: '#00D856',
        yellow: '#FFD700',
        red: '#E10600',
        blue: '#0095FF',
    },
    neutral: {
        white: '#FFFFFF',
        offWhite: '#F8F8FA',
        lightGray: '#E8E8ED',
        gray: '#A0A0AB',
        darkGray: '#5A5A65',
        almostBlack: '#1A1A24',
        carbon: '#15151E',
        titanium: '#2A2A35',
        black: '#000000',
    },
};

export const spacing = {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    hero: 64,
};

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
};

export const typography = {
    size: {
        xs: 11,
        sm: 13,
        base: 15,
        lg: 17,
        xl: 20,
        xxl: 24,
        xxxl: 28,
        display: 34,
        hero: 42,
    },
    weight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        heavy: '800' as const,
        black: '900' as const,
    },
    letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.5,
        wider: 1,
        widest: 2,
    },
};

export const shadows = {
    level1: {
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1,
    },
    level2: {
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 3,
    },
    level3: {
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.16,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 16,
        elevation: 5,
    },
    glow: {
        shadowColor: colors.brand.primary,
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 12,
        elevation: 4,
    },
};

export const timingTextStyle = {
    fontFamily: 'Menlo',
    fontVariant: ['tabular-nums'] as const,
};

