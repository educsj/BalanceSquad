import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Player, RootStackParamList } from '../types';
import { getPeladaById, addDrawRecord } from '../storage';
import { balanceTeams } from '../utils/balancer';

type RouteProps = RouteProp<RootStackParamList, 'DrawConfig'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_OPTIONS = [2, 3, 4];

export default function DrawConfigScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId, selectedPlayerIds, guestPlayers } = params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [players, setPlayers] = useState<Player[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(5);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        const present = pelada.players.filter(p => selectedPlayerIds.includes(p.id));
        setPlayers([...present, ...(guestPlayers ?? [])]);
        setPlayersPerTeam(pelada.playersPerTeam);
      });
    }, [peladaId])
  );

  const totalSlots = numTeams * playersPerTeam;
  const overflow = players.length - totalSlots;

  function slotInfo(): string {
    if (overflow === 0) return t('drawConfig.perfectDist', { teams: numTeams, perTeam: playersPerTeam });
    if (overflow > 0) return t('drawConfig.overflowDist', { count: overflow, teams: numTeams, perTeam: playersPerTeam, overflow });
    const free = -overflow;
    return t('drawConfig.slotsDist', { count: free, teams: numTeams, perTeam: playersPerTeam, free });
  }

  function validate(): boolean {
    if (players.length < numTeams * 2) {
      Alert.alert(
        t('drawConfig.notEnoughPlayers'),
        t('drawConfig.notEnoughPlayersMsg', { min: numTeams * 2, teams: numTeams })
      );
      return false;
    }
    return true;
  }

  async function handleDraw() {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{t('drawConfig.playersSelected', { count: players.length })}</Text>
        <Text style={styles.infoSub}>{slotInfo()}</Text>
      </View>

      <View style={styles.configCard}>
        <Text style={styles.configLabel}>{t('drawConfig.teamsLabel')}</Text>
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

      <View style={styles.configCard}>
        <Text style={styles.configLabel}>{t('drawConfig.playersPerTeam')}</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.stepBtn, playersPerTeam <= 1 && styles.stepBtnDisabled]}
            onPress={() => setPlayersPerTeam(v => Math.max(1, v - 1))}
            disabled={playersPerTeam <= 1}
          >
            <Feather name="minus" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.stepValue}>{playersPerTeam}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setPlayersPerTeam(v => v + 1)}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, { bottom: 24 + insets.bottom }]}>
        <TouchableOpacity style={styles.manualBtn} onPress={handleManual}>
          <Feather name="edit-3" size={16} color="#1E3A5F" />
          <Text style={styles.manualBtnText}>{t('drawConfig.manualDraw')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawBtn} onPress={handleDraw}>
          <Feather name="zap" size={18} color="#fff" />
          <Text style={styles.drawBtnText}>{t('drawConfig.autoDraw')}</Text>
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
  stepValue: { fontSize: 22, fontWeight: '800', color: '#1E3A5F', minWidth: 34, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 24, left: 16, right: 16, gap: 10 },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#1E3A5F',
    elevation: 2,
  },
  manualBtnText: { color: '#1E3A5F', fontWeight: '700', fontSize: 15 },
  drawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    elevation: 6,
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  drawBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
