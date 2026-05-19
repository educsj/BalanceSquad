import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import AppNavigator from './src/navigation/AppNavigator';
import AnimatedSplash from './src/components/AnimatedSplash';
import i18n, { initI18n } from './src/i18n';
import { getLanguage } from './src/storage';
import { ThemeProvider } from './src/theme';
import { configureNotificationBehavior } from './src/utils/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Foreground notification behavior — must be set before any notification
// could fire. Safe to call at module scope; doesn't request permissions.
configureNotificationBehavior();

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    getLanguage().then(lang => initI18n(lang).then(() => setI18nReady(true)));
  }, []);

  if (!i18nReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <AppNavigator />
            {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
          </SafeAreaProvider>
        </I18nextProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
