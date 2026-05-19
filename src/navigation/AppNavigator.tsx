import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../theme';
import { RootStackParamList } from '../types';
import { loadPeladas } from '../storage';
import HomeScreen from '../screens/HomeScreen';
import PeladaHubScreen from '../screens/PeladaHubScreen';
import PlayerRegisterScreen from '../screens/PlayerRegisterScreen';
import PlayerListScreen from '../screens/PlayerListScreen';
import DrawConfigScreen from '../screens/DrawConfigScreen';
import TeamsScreen from '../screens/TeamsScreen';
import ManualTeamsScreen from '../screens/ManualTeamsScreen';
import DrawHistoryScreen from '../screens/DrawHistoryScreen';
import RankingScreen from '../screens/RankingScreen';
import MatchesScreen from '../screens/MatchesScreen';
import MatchEditorScreen from '../screens/MatchEditorScreen';
import PlayerProfileScreen from '../screens/PlayerProfileScreen';
import SessionsCalendarScreen from '../screens/SessionsCalendarScreen';
import SessionCreateScreen from '../screens/SessionCreateScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';

const Stack = createStackNavigator<RootStackParamList>();

// Routes a notification's data payload to the right screen. Used both when
// the app is already open (listener) and on cold launch (last response).
async function routeNotification(
  navRef: NavigationContainerRef<RootStackParamList>,
  data: Record<string, unknown> | null | undefined,
) {
  if (!data) return;
  const type = data.type as string | undefined;
  if (type === 'session') {
    const peladaId = data.peladaId as string | undefined;
    const sessionId = data.sessionId as string | undefined;
    if (peladaId && sessionId) {
      navRef.navigate('SessionDetail', { peladaId, sessionId });
    }
    return;
  }
  if (type === 'admin_weekly') {
    // Open the calendar of the first pelada with an upcoming session.
    const peladas = await loadPeladas();
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const target = peladas.find(p => (p.sessions ?? []).some(
      s => s.status === 'scheduled' && s.date >= todayIso,
    ));
    if (target) {
      navRef.navigate('SessionsCalendar', { peladaId: target.id });
    } else if (peladas[0]) {
      navRef.navigate('PeladaHub', { peladaId: peladas[0].id });
    }
  }
}

export default function AppNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Listener: fires when user taps a notification while the app is alive
    // (foreground or background).
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      if (!navRef.current) return;
      routeNotification(navRef.current, response.notification.request.content.data);
    });

    // Cold launch: app was opened by tapping a notification while killed.
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response || !navRef.current) return;
      routeNotification(navRef.current, response.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);

  const headerStyle = {
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.headerText,
    headerTitleStyle: { fontWeight: '700' as const },
  };

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={headerStyle}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PeladaHub" component={PeladaHubScreen} options={{ title: '' }} />
        <Stack.Screen name="PlayerRegister" component={PlayerRegisterScreen} options={{ title: t('nav.registerPlayer') }} />
        <Stack.Screen name="PlayerList" component={PlayerListScreen} options={{ title: t('nav.playerList') }} />
        <Stack.Screen name="DrawConfig" component={DrawConfigScreen} options={{ title: t('nav.drawConfig') }} />
        <Stack.Screen name="Teams" component={TeamsScreen} options={{ title: t('nav.teams') }} />
        <Stack.Screen name="ManualTeams" component={ManualTeamsScreen} options={{ title: t('nav.manualTeams') }} />
        <Stack.Screen name="DrawHistory" component={DrawHistoryScreen} options={{ title: t('nav.drawHistory') }} />
        <Stack.Screen name="Ranking" component={RankingScreen} options={{ title: t('nav.ranking') }} />
        <Stack.Screen name="Matches" component={MatchesScreen} options={{ title: t('nav.matches') }} />
        <Stack.Screen name="MatchEditor" component={MatchEditorScreen} options={{ title: t('nav.matchEditor') }} />
        <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: t('nav.playerProfile') }} />
        <Stack.Screen name="SessionsCalendar" component={SessionsCalendarScreen} options={{ title: t('nav.sessionsCalendar') }} />
        <Stack.Screen name="SessionCreate" component={SessionCreateScreen} options={{ title: t('nav.sessionCreate') }} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: t('nav.sessionDetail') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
