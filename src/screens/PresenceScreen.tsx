import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Player, Team, RootStackParamList, BottomTabParamList } from '../types';
import { getPeladaById, updatePelada } from '../storage';
import { balanceTeams } from '../utils/balancer';
import StarRating from '../components/StarRating';

type RouteProps = RouteProp<BottomTabParamList, 'Presence'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_OPTIONS = [2, 3, 4];

export default function PresenceScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;
  const navigation = useNavigation<Nav>();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [numTeams, setNumTeams] = useState(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const [lastDraw, setLastDraw] = useState<Team[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        const list = pelada.players;
        setPlayers(list);
        setPlayersPerTeam(pelada.playersPerTeam);
        setLastDraw(pelada.lastDraw ?? null);
        setSelected(prev => {
          const valid = new Set(list.map(p => p.id));
          return new Set([...prev].filter(id => valid.has(id)));
        });
      });
    }, [peladaId])
  );

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === players.length
      ? new Set()
      : new Set(players.map(p => p.id))
    );
  }

  async function handleDraw() {
    const present = players.filter(p => selected.has(p.id));
    if (present.length < numTeams * 2) {
      Alert.alert('Jogadores insuficientes', `São necessários ao menos ${numTeams * 2} jogadores para ${numTeams} times.`);
      return;
    }
    const teams = balanceTeams(present, numTeams, playersPerTeam);

    // Persist the draw so it survives app restarts
    const pelada = await getPeladaById(peladaId);
    if (pelada) await updatePelada({ ...pelada, lastDraw: teams });
    setLastDraw(teams);

    navigation.navigate('Teams', { teams, peladaId });
  }

  function viewSavedDraw() {
    if (lastDraw) navigation.navigate('Teams', { teams: lastDraw, peladaId });
  }

  return (
    <View style={styles.container}>
      {/* Saved draw banner */}
      {lastDraw && lastDraw.length > 0 && (
        <TouchableOpacity style={styles.savedBanner} onPress={viewSavedDraw} activeOpacity={0.85}>
          <View style={styles.savedBannerLeft}>
            <Text style={styles.savedBannerTitle}>Sorteio salvo</Text>
            <Text style={styles.savedBannerMeta}>
              {lastDraw.length} time{lastDraw.length !== 1 ? 's' : ''} · toque para ver e mesclar
            </Text>
          </View>
          <Text style={styles.savedBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.configRow}>
        <Text style={styles.configLabel}>Número de times:</Text>
        <View style={styles.teamOptions}>
          {TEAM_OPTIONS.map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.teamBtn, numTeams === n && styles.teamBtnActive]}
              onPress={() => setNumTeams(n)}
            >
              <Text style={[styles.teamBtnText, numTeams === n && styles.teamBtnTextActive]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {selected.size} / {players.length} presentes
        </Text>
        <TouchableOpacity onPress={toggleAll}>
          <Text style={styles.toggleAll}>
            {selected.size === players.length ? 'Desmarcar todos' : 'Marcar todos'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.checkCircle}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, isSelected && styles.cardNameSelected]}>
                  {item.name}
                </Text>
                <StarRating value={item.level} readonly size={14} />
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum jogador cadastrado ainda.</Text>
        }
      />

      <TouchableOpacity
        style={[styles.drawButton, selected.size < 2 && styles.drawButtonDisabled]}
        onPress={handleDraw}
        disabled={selected.size < 2}
      >
        <Text style={styles.drawButtonText}>⚽  Sortear Times</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },

  savedBanner: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  savedBannerLeft: { flex: 1 },
  savedBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  savedBannerMeta: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  savedBannerArrow: { color: '#fff', fontSize: 22, fontWeight: '300' },

  configRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  configLabel: { color: '#1E3A5F', fontWeight: '600', fontSize: 14 },
  teamOptions: { flexDirection: 'row', gap: 8 },
  teamBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBtnActive: { borderColor: '#1E3A5F', backgroundColor: '#1E3A5F' },
  teamBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  teamBtnTextActive: { color: '#fff' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  toggleAll: { color: '#1E3A5F', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#1E3A5F', backgroundColor: '#EEF2FF' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#1E3A5F', fontWeight: '700', fontSize: 14 },
  cardInfo: { gap: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#475569' },
  cardNameSelected: { color: '#1E3A5F' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 14 },
  drawButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  drawButtonDisabled: { backgroundColor: '#94A3B8' },
  drawButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
