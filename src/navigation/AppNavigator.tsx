import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { RootStackParamList } from '../types';
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

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const headerStyle = {
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.headerText,
    headerTitleStyle: { fontWeight: '700' as const },
  };

  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
