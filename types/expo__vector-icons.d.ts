declare module '@expo/vector-icons' {
    import { ComponentType } from 'react';
    import { TextProps } from 'react-native';

    export const MaterialCommunityIcons: ComponentType<
        TextProps & { name: string; size?: number; color?: string }
    >;
    export const Ionicons: ComponentType<TextProps & { name: string; size?: number; color?: string }>;
}
