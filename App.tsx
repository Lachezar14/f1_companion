import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './frontend/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
    return (
        <SafeAreaProvider>
            <AppNavigator />
            <StatusBar style="auto" />
        </SafeAreaProvider>
    );
}
