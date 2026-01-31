import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';

interface CustomTabBarProps {
    state: any;
    descriptors: any;
    navigation: any;
}

export default function CustomTabBar({
                                         state,
                                         descriptors,
                                         navigation,
                                     }: CustomTabBarProps) {
    return (
        <View style={styles.container}>
            {/* Racing stripe accent */}
            <View style={styles.racingStripe} />

            {/* Tab buttons */}
            <View style={styles.tabBar}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    // Get icon name based on route
                    const getIconName = (routeName: string) => {
                        switch (routeName) {
                            case 'SessionsTab':
                                return 'calendar-month';
                            case 'DriversTab':
                                return 'account-group';
                            case 'StandingsTab':
                                return 'trophy';
                            case 'SettingsTab':
                                return 'cog';
                            default:
                                return 'circle';
                        }
                    };

                    return (
                        <TabButton
                            key={route.key}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            isFocused={isFocused}
                            label={label}
                            iconName={getIconName(route.name)}
                        />
                    );
                })}
            </View>
        </View>
    );
}

interface TabButtonProps {
    onPress: () => void;
    onLongPress: () => void;
    isFocused: boolean;
    label: string;
    iconName: string;
}

function TabButton({
                       onPress,
                       onLongPress,
                       isFocused,
                       label,
                       iconName,
                   }: TabButtonProps) {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const translateYAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isFocused ? 1.1 : 1,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.spring(translateYAnim, {
                toValue: isFocused ? -4 : 0,
                useNativeDriver: true,
                friction: 5,
            }),
        ]).start();
    }, [isFocused]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: isFocused ? 1.1 : 1,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.tabButton}
            activeOpacity={1}
        >
            <Animated.View
                style={[
                    styles.tabButtonContent,
                    {
                        transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
                    },
                ]}
            >
                {/* Active indicator */}
                {isFocused && <View style={styles.activeIndicator} />}

                {/* Icon container with background */}
                <View
                    style={[
                        styles.iconContainer,
                        isFocused && styles.iconContainerActive,
                    ]}
                >
                    <MaterialCommunityIcons
                        name={iconName as any}
                        size={24}
                        color={
                            isFocused
                                ? theme.colors.primary.red
                                : theme.colors.text.tertiary
                        }
                    />
                </View>

                {/* Label */}
                <Text
                    style={[
                        styles.tabLabel,
                        isFocused && styles.tabLabelActive,
                    ]}
                >
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.light,
        ...theme.shadows.lg,
        position: 'relative',
    },

    racingStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: theme.colors.primary.red,
    },

    tabBar: {
        flexDirection: 'row',
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: 8,
        paddingHorizontal: 8,
    },

    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },

    tabButtonContent: {
        alignItems: 'center',
        position: 'relative',
    },

    activeIndicator: {
        position: 'absolute',
        top: -12,
        width: 32,
        height: 3,
        backgroundColor: theme.colors.primary.red,
        borderRadius: theme.borderRadius.full,
    },

    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginBottom: 4,
    },

    iconContainerActive: {
        backgroundColor: theme.colors.primary.red + '10', // 10% opacity
    },

    tabLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.medium,
        color: theme.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.wide,
    },

    tabLabelActive: {
        color: theme.colors.primary.red,
        fontWeight: theme.typography.fontWeight.bold,
    },
});