import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, BottomTabParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import PlayersScreen from '../screens/PlayersScreen';
import PresenceScreen from '../screens/PresenceScreen';
import TeamsScreen from '../screens/TeamsScreen';
import ManualTeamsScreen from '../screens/ManualTeamsScreen';
import DrawHistoryScreen from '../screens/DrawHistoryScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const HEADER_STYLE = {
  headerStyle: { backgroundColor: '#1E3A5F' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

type PeladaTabsProps = StackScreenProps<RootStackParamList, 'PeladaTabs'>;

function PeladaTabs({ route }: PeladaTabsProps) {
  const { peladaId } = route.params;
  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        ...HEADER_STYLE,
        tabBarActiveTintColor: '#1E3A5F',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E2E8F0' },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 12 },
        tabBarIcon: ({ size }) => {
          const icons: Record<string, string> = { Players: '👥', Presence: '✅' };
          return <Text style={{ fontSize: size - 4 }}>{icons[tabRoute.name]}</Text>;
        },
      })}
    >
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        initialParams={{ peladaId }}
        options={{ title: 'Jogadores' }}
      />
      <Tab.Screen
        name="Presence"
        component={PresenceScreen}
        initialParams={{ peladaId }}
        options={{ title: 'Sorteio' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={HEADER_STYLE}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="PeladaTabs"
          component={PeladaTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Teams" component={TeamsScreen} options={{ title: 'Times Sorteados' }} />
        <Stack.Screen name="ManualTeams" component={ManualTeamsScreen} options={{ title: 'Montar Times' }} />
        <Stack.Screen name="DrawHistory" component={DrawHistoryScreen} options={{ title: 'Histórico de Sorteios' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
