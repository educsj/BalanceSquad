import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Player, RootStackParamList } from '../types';
import { getPeladaById, updatePelada, getHideRatings } from '../storage';
import StarRating from '../components/StarRating';

type RouteProps = RouteProp<RootStackParamList, 'PlayerList'>;
type Nav = StackNavigationProp<RootStackParamList>;

export default function PlayerListScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;
  const navigation = useNavigation<Nav>();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideRatings, setHideRatingsState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getPeladaById(peladaId), getHideRatings()]).then(([pelada, hide]) => {
        if (!pelada) return;
        const list = pelada.players;
        setPlayers(list);
        setHideRatingsState(hide);
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

  async function handleDelete(id: string) {
    Alert.alert('Remover jogador', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          const pelada = await getPeladaById(peladaId);
          if (!pelada) return;
          const updated = pelada.players.filter(p => p.id !== id);
          await updatePelada({ ...pelada, players: updated });
          setPlayers(updated);
          setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
        },
      },
    ]);
  }

  function handleContinue() {
    navigation.navigate('DrawConfig', { peladaId, selectedPlayerIds: [...selected] });
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {selected.size} / {players.length} selecionados
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
                {!hideRatings && <StarRating value={item.level} readonly size={14} />}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('PlayerRegister', { peladaId, editPlayerId: item.id })}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.actionIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.actionIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum jogador cadastrado ainda.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('PlayerRegister', { peladaId })}
            >
              <Text style={styles.emptyBtnText}>+ Cadastrar Jogador</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.continueBtn, selected.size < 2 && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={selected.size < 2}
      >
        <Text style={styles.continueBtnText}>
          {selected.size < 2
            ? 'Selecione ao menos 2 jogadores'
            : `Continuar com ${selected.size} jogadores  →`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    flexShrink: 0,
  },
  checkMark: { color: '#1E3A5F', fontWeight: '700', fontSize: 14 },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#475569' },
  cardNameSelected: { color: '#1E3A5F' },
  cardActions: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 17 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 16 },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  emptyBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  continueBtn: {
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
  continueBtnDisabled: { backgroundColor: '#94A3B8', elevation: 0, shadowOpacity: 0 },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
