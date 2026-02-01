import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SessionsScreen from '../screen/SessionsScreen';
import DriversScreen from '../screen/DriversScreen';
import DriverOverviewScreen from "../screen/DriverRaceDetailsScreen";
import GPScreen from "../screen/GPScreen";
import FreePracticeScreen from "../screen/FreePracticeScreen";
import QualifyingScreen from "../screen/QualifyingScreen";
import RaceScreen from "../screen/RaceScreen";
import DriverSeasonScreen from "../screen/DriverSeasonScreen";

const Tab = createBottomTabNavigator();
const SessionsStackNavigator = createNativeStackNavigator();
const DriversStackNavigator = createNativeStackNavigator();

function SessionsStack({ navigation, route }: any) {
    return (
        <SessionsStackNavigator.Navigator>
            <SessionsStackNavigator.Screen
                name="SessionsList"
                component={SessionsScreen}
                options={{ title: 'Sessions' }}
            />
            <SessionsStackNavigator.Screen
                name="DriverOverview"
                component={DriverOverviewScreen}
                options={{ title: 'Driver Overview' }}
            />
            <SessionsStackNavigator.Screen
                name="GPScreen"
                component={GPScreen}
                options={{ title: 'Grand Prix' }}
            />
            <SessionsStackNavigator.Screen
                name="FreePracticeScreen"
                component={FreePracticeScreen}
                options={{ title: 'Free Practice' }}
            />
            <SessionsStackNavigator.Screen
                name="QualifyingScreen"
                component={QualifyingScreen}
                options={{ title: 'Qualifying' }}
            />
            <SessionsStackNavigator.Screen
                name="RaceScreen"
                component={RaceScreen}
                options={{ title: 'Race' }}
            />
        </SessionsStackNavigator.Navigator>
    );
}

function DriversStack() {
    return (
        <DriversStackNavigator.Navigator>
            <DriversStackNavigator.Screen
                name="DriversList"
                component={DriversScreen}
                options={{ title: 'Drivers' }}
            />
            <DriversStackNavigator.Screen
                name="DriverSeasonDetails"
                component={DriverSeasonScreen}
                options={{ title: 'Drivers' }}
            />
        </DriversStackNavigator.Navigator>
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
                        tabBarIcon: () => (
                            <MaterialCommunityIcons
                                name="compass"
                                size={24}
                                color="black"
                            />
                        )
                    }}
                />
                <Tab.Screen
                    name="DriversTab"
                    component={DriversStack}
                    options={{
                        title: 'Drivers',
                        tabBarIcon: () => (
                            <MaterialCommunityIcons
                                name="account"
                                size={24}
                                color="black"
                            />
                        )
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
