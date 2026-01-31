// F1 Companion - Racing-Inspired Design System
// Modern motorsport aesthetic with speed, precision, and elegance

export const colors = {
    // Primary F1 Racing Colors
    primary: {
        red: '#E10600',           // F1 Red - Main brand
        darkRed: '#B00500',       // Darker red for pressed states
        carbon: '#15151E',        // Carbon fiber black
        titanium: '#2A2A35',      // Metallic dark gray
    },

    // Podium Colors
    podium: {
        gold: '#FFD700',          // 1st place
        silver: '#C0C0C0',        // 2nd place
        bronze: '#CD7F32',        // 3rd place
    },

    // Tyre Compound Colors (Pirelli)
    tyres: {
        soft: '#E10600',          // Red
        medium: '#FFD700',        // Yellow
        hard: '#FFFFFF',          // White
        intermediate: '#00A650',  // Green
        wet: '#0066CC',           // Blue
    },

    // Semantic Colors
    semantic: {
        success: '#00D856',       // Green flag
        warning: '#FFD700',       // Yellow flag
        danger: '#E10600',        // Red flag
        info: '#0095FF',          // Blue flag
    },

    // Neutral Palette
    neutral: {
        white: '#FFFFFF',
        offWhite: '#F8F8FA',
        lightGray: '#E8E8ED',
        gray: '#A0A0AB',
        darkGray: '#5A5A65',
        almostBlack: '#1A1A24',
        black: '#000000',
    },

    // Background & Surface
    background: {
        primary: '#F2F2F7',       // Main background
        secondary: '#FFFFFF',     // Card background
        tertiary: '#F8F8FA',      // Nested cards
        dark: '#15151E',          // Dark mode background
        gradient: {
            racing: ['#E10600', '#B00500', '#15151E'],
            podium: ['#FFD700', '#FFA500', '#FF6B00'],
            speed: ['#0095FF', '#0066CC', '#003E7A'],
            carbon: ['#2A2A35', '#15151E', '#000000'],
        },
    },

    // Text Colors
    text: {
        primary: '#15151E',
        secondary: '#5A5A65',
        tertiary: '#A0A0AB',
        inverse: '#FFFFFF',
        accent: '#E10600',
        muted: '#C8C8D0',
    },

    // Border & Divider
    border: {
        light: '#E8E8ED',
        medium: '#D0D0D8',
        dark: '#A0A0AB',
        accent: '#E10600',
    },

    // Shadow Colors
    shadow: {
        light: 'rgba(0, 0, 0, 0.04)',
        medium: 'rgba(0, 0, 0, 0.08)',
        heavy: 'rgba(0, 0, 0, 0.16)',
        colored: 'rgba(225, 6, 0, 0.15)',
    },
};

export const typography = {
    // Font Families - Racing-inspired
    fontFamily: {
        display: 'Formula1-Display',  // If you have F1 font license
        heading: 'System',             // Use -apple-system / Roboto
        body: 'System',
        mono: 'Menlo',                // For timing data
    },

    // Font Sizes
    fontSize: {
        xs: 11,
        sm: 13,
        base: 15,
        lg: 17,
        xl: 20,
        '2xl': 24,
        '3xl': 28,
        '4xl': 34,
        '5xl': 42,
    },

    // Font Weights
    fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        heavy: '800',
        black: '900',
    },

    // Line Heights
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },

    // Letter Spacing (for racing aesthetic)
    letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.5,
        wider: 1,
        widest: 2,
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
};

export const borderRadius = {
    none: 0,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
};

export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },

    sm: {
        shadowColor: colors.shadow.light,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 2,
        elevation: 1,
    },

    md: {
        shadowColor: colors.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },

    lg: {
        shadowColor: colors.shadow.heavy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 5,
    },

    // Racing-specific shadows
    racing: {
        shadowColor: colors.shadow.colored,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 4,
    },

    glow: {
        shadowColor: colors.primary.red,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 0,
    },
};

export const animations = {
    // Duration in milliseconds
    duration: {
        instant: 100,
        fast: 200,
        normal: 300,
        slow: 500,
        slower: 700,
    },

    // Easing curves
    easing: {
        linear: 'linear',
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
        spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        racing: 'cubic-bezier(0.87, 0, 0.13, 1)', // Fast acceleration
    },
};

export const layout = {
    // Container max widths
    container: {
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
    },

    // Standard spacing
    gutter: spacing.base,
    sectionSpacing: spacing['2xl'],

    // Card dimensions
    card: {
        minHeight: 120,
        maxHeight: 300,
    },

    // Header heights
    header: {
        default: 60,
        large: 120,
    },

    // Tab bar
    tabBar: {
        height: 60,
        iconSize: 24,
    },
};

// Component-specific theme presets
export const components = {
    button: {
        height: {
            sm: 36,
            md: 44,
            lg: 52,
        },
        paddingHorizontal: {
            sm: spacing.md,
            md: spacing.lg,
            lg: spacing.xl,
        },
    },

    input: {
        height: 48,
        borderWidth: 1,
        paddingHorizontal: spacing.base,
    },

    card: {
        padding: spacing.base,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
    },

    avatar: {
        size: {
            sm: 32,
            md: 40,
            lg: 56,
            xl: 80,
        },
    },

    badge: {
        height: 24,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.full,
    },
};

// Export complete theme object
export const theme = {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    animations,
    layout,
    components,
};

export default theme;