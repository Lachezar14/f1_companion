import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SessionsScreen from '../screen/SessionsScreen';
import DriversScreen from '../screen/drivers/DriversScreen';
import DriverOverviewScreen from "../screen/sessions/race/DriverRaceDetailsScreen";
import DriverPracticeDetailsScreen from "../screen/sessions/practice/DriverPracticeDetailsScreen";
import GPScreen from "../screen/GPScreen";
import FreePracticeScreen from "../screen/sessions/practice/FreePracticeScreen";
import QualifyingScreen from "../screen/sessions/qualifying/QualifyingScreen";
import QualifyingClassificationScreen from "../screen/sessions/qualifying/QualifyingClassificationScreen";
import RaceScreen from "../screen/sessions/race/RaceScreen";
import RaceOvertakesScreen from "../screen/sessions/race/RaceOvertakesScreen";
import RaceClassificationScreen from "../screen/sessions/race/RaceClassificationScreen";
import DriverSeasonScreen from "../screen/drivers/DriverSeasonScreen";
import FloatingTabBar from '../component/navigation/FloatingTabBar';
import StackScreenWrapper from '../component/navigation/StackScreenWrapper';
import StandingsScreen from '../screen/StandingsScreen';

const Tab = createBottomTabNavigator();
const SessionsStackNavigator = createNativeStackNavigator();
const DriversStackNavigator = createNativeStackNavigator();

type WrapperOptions = {
    title?: string;
    getTitle?: (props: any) => string | undefined;
};

const withStackScreenWrapper = (
    Component: React.ComponentType<any>,
    options?: WrapperOptions
) => {
    return function WrappedScreen(props: any) {
        const headerTitle = options?.getTitle?.(props) ?? options?.title;
        return (
            <StackScreenWrapper title={headerTitle}>
                <Component {...props} />
            </StackScreenWrapper>
        );
    };
};

const DriverOverviewWithHeader = withStackScreenWrapper(DriverOverviewScreen, {
    title: 'Driver Overview',
});

const DriverPracticeDetailsWithHeader = withStackScreenWrapper(DriverPracticeDetailsScreen, {
    title: 'Practice Driver',
});

const GPDetailsWithHeader = withStackScreenWrapper(GPScreen, {
    title: 'Grand Prix',
});

const FreePracticeWithHeader = withStackScreenWrapper(FreePracticeScreen, {
    title: 'Free Practice',
});

const QualifyingWithHeader = withStackScreenWrapper(QualifyingScreen, {
    title: 'Qualifying',
});

const QualifyingClassificationWithHeader = withStackScreenWrapper(QualifyingClassificationScreen, {
    title: 'Qualifying Classification',
});

const RaceWithHeader = withStackScreenWrapper(RaceScreen, {
    title: 'Race',
});

const RaceOvertakesWithHeader = withStackScreenWrapper(RaceOvertakesScreen, {
    title: 'Overtakes',
});

const RaceClassificationWithHeader = withStackScreenWrapper(RaceClassificationScreen, {
    title: 'Classification',
});

const DriverSeasonWithHeader = withStackScreenWrapper(DriverSeasonScreen, {
    getTitle: props => props.route?.params?.driverName ?? 'Driver Season',
});

const getIsTabBarVisible = (
    route: { state?: any; params?: any; name: string } | undefined,
    initialRouteName: string
) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? initialRouteName;
    return routeName === initialRouteName;
};

function SessionsStack() {
    return (
        <SessionsStackNavigator.Navigator screenOptions={{ headerShown: false }}>
            <SessionsStackNavigator.Screen
                name="SessionsList"
                component={SessionsScreen}
                options={{ title: 'Sessions' }}
            />
            <SessionsStackNavigator.Screen
                name="DriverOverview"
                component={DriverOverviewWithHeader}
                options={{ title: 'Driver Overview' }}
            />
            <SessionsStackNavigator.Screen
                name="DriverPracticeOverview"
                component={DriverPracticeDetailsWithHeader}
                options={{ title: 'Practice Driver' }}
            />
            <SessionsStackNavigator.Screen
                name="GPScreen"
                component={GPDetailsWithHeader}
                options={{ title: 'Grand Prix' }}
            />
            <SessionsStackNavigator.Screen
                name="FreePracticeScreen"
                component={FreePracticeWithHeader}
                options={{ title: 'Free Practice' }}
            />
            <SessionsStackNavigator.Screen
                name="QualifyingScreen"
                component={QualifyingWithHeader}
                options={{ title: 'Qualifying' }}
            />
            <SessionsStackNavigator.Screen
                name="QualifyingClassification"
                component={QualifyingClassificationWithHeader}
                options={{ title: 'Qualifying Classification' }}
            />
            <SessionsStackNavigator.Screen
                name="RaceScreen"
                component={RaceWithHeader}
                options={{ title: 'Race' }}
            />
            <SessionsStackNavigator.Screen
                name="RaceOvertakes"
                component={RaceOvertakesWithHeader}
                options={{ title: 'Overtakes' }}
            />
            <SessionsStackNavigator.Screen
                name="RaceClassification"
                component={RaceClassificationWithHeader}
                options={{ title: 'Classification' }}
            />
        </SessionsStackNavigator.Navigator>
    );
}

function DriversStack() {
    return (
        <DriversStackNavigator.Navigator screenOptions={{ headerShown: false }}>
            <DriversStackNavigator.Screen
                name="DriversList"
                component={DriversScreen}
                options={{ title: 'Drivers' }}
            />
            <DriversStackNavigator.Screen
                name="DriverSeasonDetails"
                component={DriverSeasonWithHeader}
                options={{ title: 'Drivers' }}
            />
        </DriversStackNavigator.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={{ headerShown: false }}
                tabBar={props => <FloatingTabBar {...props} />}
            >
                <Tab.Screen
                    name="SessionsTab"
                    component={SessionsStack}
                    options={({ route }) => ({
                        title: 'Sessions',
                        tabBarStyle: getIsTabBarVisible(route, 'SessionsList')
                            ? undefined
                            : { display: 'none' },
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons
                                name="compass"
                                size={24}
                                color={color ?? 'black'}
                            />
                        )
                    })}
                />
                <Tab.Screen
                    name="DriversTab"
                    component={DriversStack}
                    options={({ route }) => ({
                        title: 'Drivers',
                        tabBarStyle: getIsTabBarVisible(route, 'DriversList')
                            ? undefined
                            : { display: 'none' },
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons
                                name="account"
                                size={24}
                                color={color ?? 'black'}
                            />
                        )
                    })}
                />
                <Tab.Screen
                    name="StandingsTab"
                    component={StandingsScreen}
                    options={{
                        title: 'Standings',
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons
                                name="trophy"
                                size={24}
                                color={color ?? 'black'}
                            />
                        )
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
