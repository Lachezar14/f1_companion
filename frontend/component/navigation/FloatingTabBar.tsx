import React, { useCallback, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    LayoutChangeEvent,
} from 'react-native';
import type {
    BottomTabBarProps,
    BottomTabBarLabelProps,
} from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';

const ACTIVE_BACKGROUND = '#15151E';
const INACTIVE_BACKGROUND = 'transparent';
const ACTIVE_TINT = '#FFFFFF';
const INACTIVE_TINT = '#8C8D9A';

const FloatingTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const focusedRoute = state.routes[state.index];
    const focusedOptions = descriptors[focusedRoute.key].options;
    const flattenedTabBarStyle = StyleSheet.flatten(focusedOptions.tabBarStyle) || {};
    const isHidden = flattenedTabBarStyle?.display === 'none';

    const handleLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onHeightChange?.(event.nativeEvent.layout.height);
        },
        [onHeightChange]
    );

    useEffect(() => {
        if (isHidden) {
            onHeightChange?.(0);
        }
    }, [isHidden, onHeightChange]);

    if (isHidden) {
        return null;
    }

    return (
        <View
            onLayout={handleLayout}
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, 12),
                },
                flattenedTabBarStyle,
            ]}
        >
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;
                    const color = isFocused ? ACTIVE_TINT : INACTIVE_TINT;

                    const renderLabel = () => {
                        const rawLabel =
                            options.tabBarLabel !== undefined
                                ? options.tabBarLabel
                                : options.title ?? route.name;

                        if (typeof rawLabel === 'function') {
                            return rawLabel({
                                focused: isFocused,
                                color,
                                position: 'beside-icon',
                                children: route.name,
                            } as BottomTabBarLabelProps);
                        }

                        if (typeof rawLabel === 'string') {
                            return (
                                <Text style={[styles.label, { color }]}>
                                    {rawLabel}
                                </Text>
                            );
                        }

                        if (React.isValidElement(rawLabel)) {
                            return rawLabel;
                        }

                        return (
                            <Text style={[styles.label, { color }]}>
                                {route.name}
                            </Text>
                        );
                    };

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
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="tab"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarButtonTestID}
                            activeOpacity={0.9}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={[
                                styles.tabButton,
                                {
                                    backgroundColor: isFocused
                                        ? ACTIVE_BACKGROUND
                                        : INACTIVE_BACKGROUND,
                                },
                            ]}
                        >
                            <View style={styles.iconLabelRow}>
                                {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
                                {renderLabel()}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default FloatingTabBar;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E6EA',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#F3F3F6',
        borderRadius: 22,
        padding: 8,
    },
    tabButton: {
        flex: 1,
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: 4,
    },
    iconLabelRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapper: {
        marginRight: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
    },
});
