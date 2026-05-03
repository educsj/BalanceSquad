import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { getPeladaById } from '../storage';

type RouteProps = RouteProp<RootStackParamList, 'PeladaHub'>;
type Nav = StackNavigationProp<RootStackParamList>;

function formatShortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} às ${hours}:${mins}`;
}

export default function PeladaHubScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;
  const navigation = useNavigation<Nav>();

  const [playerCount, setPlayerCount] = useState(0);
  const [drawCount, setDrawCount] = useState(0);
  const [lastDrawDate, setLastDrawDate] = useState('');

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        navigation.setOptions({ title: pelada.name });
        setPlayerCount(pelada.players.length);
        const history = pelada.drawHistory ?? [];
        setDrawCount(history.length);
        setLastDrawDate(history[0]?.timestamp ?? '');
      });
    }, [peladaId])
  );

  const actions = [
    {
      icon: '👤',
      title: 'Cadastrar Jogador(a)',
      subtitle: `${playerCount} jogador${playerCount !== 1 ? 'es' : ''} cadastrado${playerCount !== 1 ? 's' : ''}`,
      onPress: () => navigation.navigate('PlayerRegister', { peladaId }),
    },
    {
      icon: '📋',
      title: 'Lista de Jogadores',
      subtitle: playerCount > 0
        ? 'Selecionar presença e sortear'
        : 'Nenhum jogador cadastrado ainda',
      onPress: () => navigation.navigate('PlayerList', { peladaId }),
    },
    {
      icon: '📅',
      title: 'Histórico de Sorteios',
      subtitle: lastDrawDate
        ? `Último: ${formatShortDate(lastDrawDate)} · ${drawCount} registro${drawCount !== 1 ? 's' : ''}`
        : 'Nenhum sorteio realizado ainda',
      onPress: () => navigation.navigate('DrawHistory', { peladaId }),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {actions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.card}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{action.icon}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardSubtitle}>{action.subtitle}</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 20 },
  actions: { gap: 14, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  cardIcon: { fontSize: 28 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A5F' },
  cardSubtitle: { fontSize: 13, color: '#64748B' },
  cardArrow: { fontSize: 26, color: '#94A3B8', fontWeight: '300' },
});
