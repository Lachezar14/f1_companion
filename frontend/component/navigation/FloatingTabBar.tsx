import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { radius, semanticColors, spacing } from '../../theme/tokens';
import {
    Animated,
    View,
    Pressable,
    StyleSheet,
    LayoutChangeEvent,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { ViewStyle } from 'react-native';

const ACTIVE_TINT = semanticColors.surface;
const INACTIVE_TINT = '#5F6472';
const TAB_BAR_PADDING = 2;
const TAB_BUTTON_HEIGHT = 36;
const TAB_BUTTON_GAP = 3;

const FloatingTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const indicatorProgress = useRef(new Animated.Value(state.index)).current;
    const [tabBarWidth, setTabBarWidth] = useState(0);
    const focusedRoute = state.routes[state.index];
    const focusedOptions = descriptors[focusedRoute.key].options;
    const flattenedTabBarStyle =
        (StyleSheet.flatten(focusedOptions.tabBarStyle) as ViewStyle | undefined) || {};
    const isHidden = flattenedTabBarStyle?.display === 'none';

    const handleContainerLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onHeightChange?.(event.nativeEvent.layout.height);
        },
        [onHeightChange]
    );

    const handleTabBarLayout = useCallback((event: LayoutChangeEvent) => {
        setTabBarWidth(event.nativeEvent.layout.width);
    }, []);

    useEffect(() => {
        if (isHidden) {
            onHeightChange?.(0);
        }
    }, [isHidden, onHeightChange]);

    useEffect(() => {
        Animated.spring(indicatorProgress, {
            toValue: state.index,
            useNativeDriver: true,
            stiffness: 220,
            damping: 24,
            mass: 0.95,
        }).start();
    }, [state.index, indicatorProgress]);

    if (isHidden) {
        return null;
    }

    const tabCount = state.routes.length || 1;
    const tabWidth = Math.max((tabBarWidth - TAB_BAR_PADDING * 2) / tabCount, 0);
    const indicatorTranslateX = Animated.multiply(indicatorProgress, tabWidth);

    return (
        <View
            onLayout={handleContainerLayout}
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, 6),
                },
                flattenedTabBarStyle,
            ]}
        >
            <View onLayout={handleTabBarLayout} style={styles.tabBar}>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.activePill,
                        {
                            width: Math.max(tabWidth - TAB_BUTTON_GAP * 2, 0),
                            transform: [{ translateX: indicatorTranslateX }],
                        },
                    ]}
                />
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;
                    const color = isFocused ? ACTIVE_TINT : INACTIVE_TINT;
                    const icon = options.tabBarIcon?.({
                        focused: isFocused,
                        color,
                        size: 22,
                    });

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.dispatch({
                                ...CommonActions.navigate(route),
                                target: state.key,
                            });
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    return (
                        <View key={route.key} style={styles.tabSlot}>
                            <Pressable
                                accessibilityRole="tab"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                                testID={options.tabBarButtonTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                android_ripple={{
                                    color: 'rgba(32, 36, 49, 0.08)',
                                    borderless: false,
                                }}
                                style={({ pressed }) => [
                                    styles.tabButton,
                                    pressed && styles.tabButtonPressed,
                                ]}
                            >
                                <View style={styles.iconLabelRow}>
                                    {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
                                </View>
                            </Pressable>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

export default FloatingTabBar;

const styles = StyleSheet.create({
    container: {
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: semanticColors.border,
    },
    tabBar: {
        flexDirection: 'row',
        position: 'relative',
        backgroundColor: semanticColors.surface,
        borderRadius: radius.lg,
        paddingBottom: spacing.sm,
        padding: TAB_BAR_PADDING,
    },
    activePill: {
        position: 'absolute',
        left: TAB_BAR_PADDING + TAB_BUTTON_GAP,
        top: TAB_BAR_PADDING + TAB_BUTTON_GAP,
        height: TAB_BUTTON_HEIGHT,
        borderRadius: radius.md,
        backgroundColor: semanticColors.surfaceInverse,
        shadowColor: '#121622',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    tabSlot: {
        flex: 1,
        paddingHorizontal: TAB_BUTTON_GAP,
    },
    tabButton: {
        height: TAB_BUTTON_HEIGHT,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconLabelRow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: 1 }],
    },
    tabButtonPressed: {
        opacity: 0.8,
    },
});
