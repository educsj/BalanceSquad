import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import PeladaHubScreen from '../screens/PeladaHubScreen';
import PlayerRegisterScreen from '../screens/PlayerRegisterScreen';
import PlayerListScreen from '../screens/PlayerListScreen';
import DrawConfigScreen from '../screens/DrawConfigScreen';
import TeamsScreen from '../screens/TeamsScreen';
import ManualTeamsScreen from '../screens/ManualTeamsScreen';
import DrawHistoryScreen from '../screens/DrawHistoryScreen';

const Stack = createStackNavigator<RootStackParamList>();

const HEADER_STYLE = {
  headerStyle: { backgroundColor: '#1E3A5F' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={HEADER_STYLE}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PeladaHub" component={PeladaHubScreen} options={{ title: '' }} />
        <Stack.Screen name="PlayerRegister" component={PlayerRegisterScreen} options={{ title: 'Cadastrar Jogador' }} />
        <Stack.Screen name="PlayerList" component={PlayerListScreen} options={{ title: 'Lista de Jogadores' }} />
        <Stack.Screen name="DrawConfig" component={DrawConfigScreen} options={{ title: 'Configurar Sorteio' }} />
        <Stack.Screen name="Teams" component={TeamsScreen} options={{ title: 'Times Sorteados' }} />
        <Stack.Screen name="ManualTeams" component={ManualTeamsScreen} options={{ title: 'Montar Times' }} />
        <Stack.Screen name="DrawHistory" component={DrawHistoryScreen} options={{ title: 'Histórico de Sorteios' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
