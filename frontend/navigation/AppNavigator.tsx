import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {getFocusedRouteNameFromRoute, NavigationContainer} from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SessionsScreen from '../screen/SessionsScreen';
import GPDetailsScreen from "../screen/GPDetailsScreen";
import DriverOverviewScreen from "../screen/DriverRaceDetailsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SessionsStack({navigation, route}: any) {
    React.useLayoutEffect(() => {
        const routeName = getFocusedRouteNameFromRoute(route);
        if (routeName === "SessionDetails" || routeName === "DriverOverview") {
            navigation.setOptions({tabBarStyle: {display: 'none'}});
        }else {
            navigation.setOptions({tabBarStyle: {display: 'flex'}});
        }
    }, [navigation, route]);
    
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="SessionsList"
                component={SessionsScreen}
                options={{ title: 'Sessions' }}
            />
            <Stack.Screen
                name="SessionDetails"
                component={GPDetailsScreen}
                options={{ title: 'Details' }}
            />
            <Stack.Screen
                name="DriverOverview"
                component={DriverOverviewScreen}
                options={{ title: 'Driver Overview' }}
            />
        </Stack.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator screenOptions={{ headerShown: false }}>
                <Tab.Screen
                    name="SessionsTab"
                    component={SessionsStack}
                    options={{
                        title: 'Sessions',
                        tabBarIcon: () =>
                            <MaterialCommunityIcons
                            name="compass"
                            size={24}
                            color="black"
                        />

                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
