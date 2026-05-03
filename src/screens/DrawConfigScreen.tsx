import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Player, RootStackParamList } from '../types';
import { getPeladaById, addDrawRecord } from '../storage';
import { balanceTeams } from '../utils/balancer';

type RouteProps = RouteProp<RootStackParamList, 'DrawConfig'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_OPTIONS = [2, 3, 4];

export default function DrawConfigScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId, selectedPlayerIds } = params;
  const navigation = useNavigation<Nav>();

  const [players, setPlayers] = useState<Player[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(5);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        const present = pelada.players.filter(p => selectedPlayerIds.includes(p.id));
        setPlayers(present);
        setPlayersPerTeam(pelada.playersPerTeam);
      });
    }, [peladaId])
  );

  const totalSlots = numTeams * playersPerTeam;
  const overflow = players.length - totalSlots;

  function slotInfo(): string {
    if (overflow === 0) return `${numTeams} times de ${playersPerTeam} — distribuição perfeita`;
    if (overflow > 0) return `${numTeams} times de ${playersPerTeam} · ${overflow} jogador${overflow !== 1 ? 'es' : ''} na sobra`;
    const free = -overflow;
    return `${numTeams} times de ${playersPerTeam} · ${free} vaga${free !== 1 ? 's' : ''} livre${free !== 1 ? 's' : ''}`;
  }

  function validate(): boolean {
    if (players.length < numTeams * 2) {
      Alert.alert('Jogadores insuficientes', `São necessários ao menos ${numTeams * 2} jogadores para ${numTeams} times.`);
      return false;
    }
    return true;
  }

  async function handleDraw() {
    if (!validate()) return;
    const teams = balanceTeams(players, numTeams, playersPerTeam);
    await addDrawRecord(peladaId, teams);
    navigation.navigate('Teams', { teams, peladaId });
  }

  function handleManual() {
    if (!validate()) return;
    navigation.navigate('ManualTeams', { players, numTeams, peladaId, playersPerTeam });
  }

  return (
    <View style={styles.container}>
      {/* Player info banner */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{players.length} jogadores selecionados</Text>
        <Text style={styles.infoSub}>{slotInfo()}</Text>
      </View>

      {/* Number of teams */}
      <View style={styles.configCard}>
        <Text style={styles.configLabel}>Número de times</Text>
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

      {/* Players per team */}
      <View style={styles.configCard}>
        <Text style={styles.configLabel}>Jogadores por time</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.stepBtn, playersPerTeam <= 1 && styles.stepBtnDisabled]}
            onPress={() => setPlayersPerTeam(v => Math.max(1, v - 1))}
            disabled={playersPerTeam <= 1}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{playersPerTeam}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setPlayersPerTeam(v => v + 1)}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.manualBtn} onPress={handleManual}>
          <Text style={styles.manualBtnText}>✋  Montar Manualmente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawBtn} onPress={handleDraw}>
          <Text style={styles.drawBtnText}>⚽  Sortear Times</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },

  infoCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  infoTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  infoSub: { color: '#93C5FD', fontSize: 13, marginTop: 4 },

  configCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBtnActive: { borderColor: '#1E3A5F', backgroundColor: '#1E3A5F' },
  teamBtnText: { color: '#64748B', fontWeight: '700', fontSize: 16 },
  teamBtnTextActive: { color: '#fff' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { backgroundColor: '#CBD5E1' },
  stepBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  stepValue: { fontSize: 22, fontWeight: '800', color: '#1E3A5F', minWidth: 34, textAlign: 'center' },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    gap: 10,
  },
  manualBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E3A5F',
    elevation: 2,
  },
  manualBtnText: { color: '#1E3A5F', fontWeight: '700', fontSize: 15 },
  drawBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  drawBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
