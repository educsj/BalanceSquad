import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Player, StarLevel, RootStackParamList } from '../types';
import { getPeladaById, updatePelada } from '../storage';
import StarRating from '../components/StarRating';

type RouteProps = RouteProp<RootStackParamList, 'PlayerRegister'>;
type Nav = StackNavigationProp<RootStackParamList>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function PlayerRegisterScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId, editPlayerId } = params;
  const navigation = useNavigation<Nav>();
  const isEditing = !!editPlayerId;

  const [name, setName] = useState('');
  const [level, setLevel] = useState<StarLevel>(3);
  const [playerCount, setPlayerCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: isEditing ? 'Editar Jogador' : 'Cadastrar Jogador' });
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        setPlayerCount(pelada.players.length);
        if (editPlayerId) {
          const player = pelada.players.find(p => p.id === editPlayerId);
          if (player) {
            setName(player.name);
            setLevel(player.level);
          }
        }
      });
    }, [peladaId, editPlayerId])
  );

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pelada = await getPeladaById(peladaId);
    if (!pelada) return;

    let updatedPlayers: Player[];
    if (isEditing && editPlayerId) {
      updatedPlayers = pelada.players.map(p =>
        p.id === editPlayerId ? { ...p, name: trimmed, level } : p
      );
    } else {
      updatedPlayers = [...pelada.players, { id: generateId(), name: trimmed, level }];
    }

    await updatePelada({ ...pelada, players: updatedPlayers });
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {!isEditing && (
          <Text style={styles.counter}>
            {playerCount} jogador{playerCount !== 1 ? 'es' : ''} cadastrado{playerCount !== 1 ? 's' : ''}
          </Text>
        )}

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do jogador"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nível</Text>
            <StarRating value={level} onChange={setLevel} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim()}
        >
          <Text style={styles.saveBtnText}>
            {isEditing ? '✓  Salvar Alterações' : '+  Adicionar Jogador'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 20 },
  counter: { color: '#64748B', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    gap: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 24,
  },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#1E3A5F',
  },
  saveBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  saveBtnDisabled: { backgroundColor: '#94A3B8', elevation: 0, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
