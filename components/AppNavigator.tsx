import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


import SessionsScreen from './SessionsScreen';
import GPSessionsScreen from './GPSessionsScreen';
import SessionClassificationScreen from "./SessionClassificationScreen";
import GPDetailsScreen from "./GPDetailsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SessionsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="SessionsList"
                component={SessionsScreen}
                options={{ title: 'Sessions' }}
            />
            <Stack.Screen
                name="GPSessions"
                component={GPSessionsScreen}
                options={{ title: 'GP Sessions' }}
            />
            {/*<Stack.Screen
                name="SessionClassification"
                component={SessionClassificationScreen}
                options={{ title: 'Session Classification' }}
            />*/}
            <Stack.Screen
                name="SessionDetails"
                component={GPDetailsScreen}
                options={{ title: 'Details' }}
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
                        tabBarIcon: () => <MaterialCommunityIcons name="compass" size="24" color="black" />
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
