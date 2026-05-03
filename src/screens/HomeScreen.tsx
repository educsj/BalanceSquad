import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Pelada, RootStackParamList } from '../types';
import { loadPeladas, savePeladas, getHideRatings, setHideRatings } from '../storage';

type Nav = StackNavigationProp<RootStackParamList, 'Home'>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPlayersPerTeam, setNewPlayersPerTeam] = useState('');
  const [hideRatings, setHideRatingsState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPeladas().then(setPeladas);
      getHideRatings().then(setHideRatingsState);
    }, [])
  );

  async function toggleHideRatings() {
    const next = !hideRatings;
    setHideRatingsState(next);
    await setHideRatings(next);
  }

  function openCreateModal() {
    setEditingId(null);
    setNewName('');
    setNewPlayersPerTeam('');
    setModalVisible(true);
  }

  function openEditModal(pelada: Pelada) {
    setEditingId(pelada.id);
    setNewName(pelada.name);
    setNewPlayersPerTeam(String(pelada.playersPerTeam));
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingId(null);
  }

  async function handleSubmit() {
    const name = newName.trim();
    if (!name) return;
    const playersPerTeam = parseInt(newPlayersPerTeam, 10);
    if (!playersPerTeam || playersPerTeam < 1) {
      Alert.alert('Valor inválido', 'Informe um número válido de jogadores por time.');
      return;
    }

    let updated: Pelada[];
    if (editingId) {
      updated = peladas.map(p =>
        p.id === editingId ? { ...p, name, playersPerTeam } : p
      );
    } else {
      const nova: Pelada = { id: generateId(), name, playersPerTeam, players: [] };
      updated = [...peladas, nova];
    }

    setPeladas(updated);
    await savePeladas(updated);
    closeModal();
  }

  async function handleDelete(id: string) {
    Alert.alert('Remover pelada', 'Todos os jogadores desta pelada serão apagados. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          const updated = peladas.filter(p => p.id !== id);
          setPeladas(updated);
          await savePeladas(updated);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Balance Squad</Text>
            <Text style={styles.headerSub}>By Eduardo Coutinho</Text>
            <Text style={styles.headerLink}>github.com/educsj</Text>
          </View>
          <TouchableOpacity style={styles.ratingToggle} onPress={toggleHideRatings} activeOpacity={0.8}>
            <Text style={styles.ratingToggleIcon}>{hideRatings ? '🙈' : '👁'}</Text>
            <Text style={styles.ratingToggleText}>{hideRatings ? 'Notas\nocultas' : 'Notas\nvisíveis'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {peladas.length === 0 ? 'Nenhuma pelada cadastrada' : `${peladas.length} pelada${peladas.length > 1 ? 's' : ''}`}
      </Text>

      <FlatList
        data={peladas}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const drawCount = item.drawHistory?.length ?? 0;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PeladaHub', { peladaId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {drawCount > 0 && (
                    <View style={styles.drawBadge}>
                      <Text style={styles.drawBadgeText}>
                        {drawCount === 1 ? 'sorteio salvo' : `${drawCount} sorteios`}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardMeta}>
                  {item.players.length} jogador{item.players.length !== 1 ? 'es' : ''} · {item.playersPerTeam} por time
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Toque no botão + para criar sua primeira pelada.</Text>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar Pelada' : 'Nova Pelada'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome da pelada"
              placeholderTextColor="#94A3B8"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Jogadores por time (ex: 5)"
              placeholderTextColor="#94A3B8"
              value={newPlayersPerTeam}
              onChangeText={setNewPlayersPerTeam}
              keyboardType="number-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={closeModal}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit}>
                <Text style={styles.btnPrimaryText}>{editingId ? 'Salvar' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  header: {
    backgroundColor: '#1E3A5F',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#93C5FD', fontSize: 13, marginTop: 4 },
  headerLink: { color: '#60A5FA', fontSize: 12, marginTop: 2 },
  ratingToggle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  ratingToggleIcon: { fontSize: 20 },
  ratingToggleText: { color: '#93C5FD', fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  sectionTitle: { color: '#64748B', fontSize: 13, fontWeight: '500', margin: 16, marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  cardLeft: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1E3A5F' },
  drawBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  drawBadgeText: { fontSize: 10, fontWeight: '700', color: '#1E3A5F', letterSpacing: 0.3 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 18 },
  empty: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 60,
    fontSize: 14,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E3A5F' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 11,
    fontSize: 15,
    color: '#1E3A5F',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#1E3A5F', fontWeight: '600', fontSize: 15 },
});
