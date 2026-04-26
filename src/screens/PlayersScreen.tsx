import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { Player, StarLevel, BottomTabParamList } from '../types';
import { getPeladaById, updatePelada } from '../storage';
import StarRating from '../components/StarRating';

type RouteProps = RouteProp<BottomTabParamList, 'Players'>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function PlayersScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;

  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<StarLevel>(3);
  const [editingId, setEditingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (pelada) setPlayers(pelada.players);
      });
    }, [peladaId])
  );

  async function persist(updated: Player[]) {
    setPlayers(updated);
    const pelada = await getPeladaById(peladaId);
    if (pelada) await updatePelada({ ...pelada, players: updated });
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    setName(player.name);
    setLevel(player.level);
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setLevel(3);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editingId) {
      await persist(players.map(p =>
        p.id === editingId ? { ...p, name: trimmed, level } : p
      ));
      cancelEdit();
    } else {
      await persist([...players, { id: generateId(), name: trimmed, level }]);
      setName('');
      setLevel(3);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remover jogador', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => persist(players.filter(p => p.id !== id)) },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nome do jogador"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleSave}
          />
          <StarRating value={level} onChange={setLevel} />
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
              <Text style={styles.btnText}>{editingId ? 'Salvar' : 'Adicionar'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.btnSecondary} onPress={cancelEdit}>
                <Text style={[styles.btnText, { color: '#1E3A5F' }]}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{players.length} jogadores cadastrados</Text>

        <FlatList
          data={players}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardName}>{item.name}</Text>
                <StarRating value={item.level} readonly size={16} />
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionBtn}>
                  <Text style={styles.actionEdit}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Text style={styles.actionDelete}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1E3A5F',
  },
  formButtons: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sectionTitle: { color: '#64748B', fontSize: 13, marginBottom: 8, fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardLeft: { gap: 4 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1E3A5F' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  actionEdit: { fontSize: 18 },
  actionDelete: { fontSize: 18 },
});
