import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Player, Team, RootStackParamList } from '../types';
import { addDrawRecord } from '../storage';

type RouteProps = RouteProp<RootStackParamList, 'ManualTeams'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_COLORS = ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'];

export default function ManualTeamsScreen() {
  const { params } = useRoute<RouteProps>();
  const { players, numTeams, peladaId, playersPerTeam } = params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [assignments, setAssignments] = useState<Record<string, number | null>>(
    Object.fromEntries(players.map(p => [p.id, null]))
  );

  const teamCounts = Array.from({ length: numTeams }, (_, i) =>
    Object.values(assignments).filter(v => v === i).length
  );

  const allTeamsFull = teamCounts.every(count => count >= playersPerTeam);

  const slotsNeeded = teamCounts.reduce(
    (acc, count) => acc + Math.max(0, playersPerTeam - count),
    0
  );

  function assign(playerId: string, teamIndex: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAssignments(prev => ({
      ...prev,
      [playerId]: prev[playerId] === teamIndex ? null : teamIndex,
    }));
  }

  function buildTeams(): Team[] {
    const teamPlayers: Player[][] = Array.from({ length: numTeams }, () => []);
    for (const player of players) {
      const idx = assignments[player.id];
      if (idx !== null && idx !== undefined) {
        teamPlayers[idx].push(player);
      }
    }
    return teamPlayers.map((pl, i) => ({
      id: i + 1,
      name: `Time ${i + 1}`,
      players: pl,
      totalStars: pl.reduce((sum, p) => sum + p.level, 0),
    }));
  }

  async function handleConfirm() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const teams = buildTeams();
    await addDrawRecord(peladaId, teams);
    navigation.navigate('Teams', { teams, peladaId });
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        {Array.from({ length: numTeams }, (_, i) => {
          const count = teamCounts[i];
          const full = count >= playersPerTeam;
          const color = TEAM_COLORS[i % TEAM_COLORS.length];
          return (
            <View
              key={i}
              style={[
                styles.summaryChip,
                { borderColor: color },
                full && { backgroundColor: color },
              ]}
            >
              <Text style={[styles.summaryChipLabel, { color: full ? '#fff' : color }]}>
                {t('manualTeams.teamBtn', { num: i + 1 })}
              </Text>
              <Text style={[styles.summaryChipCount, { color: full ? '#fff' : color }]}>
                {t('manualTeams.teamCount', { count, max: playersPerTeam })}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.counter}>
        {allTeamsFull
          ? t('manualTeams.allComplete')
          : t('manualTeams.slotsNeeded', { count: slotsNeeded })}
      </Text>

      <FlatList
        data={players}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const assigned = assignments[item.id];
          return (
            <View style={styles.playerCard}>
              <Text style={styles.playerName}>{item.name}</Text>
              <View style={styles.teamBtns}>
                {Array.from({ length: numTeams }, (_, i) => {
                  const active = assigned === i;
                  const teamFull = teamCounts[i] >= playersPerTeam;
                  const disabled = teamFull && !active;
                  const color = TEAM_COLORS[i % TEAM_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.teamBtn,
                        { borderColor: disabled ? '#CBD5E1' : color },
                        active && { backgroundColor: color },
                      ]}
                      onPress={() => !disabled && assign(item.id, i)}
                      activeOpacity={disabled ? 1 : 0.75}
                    >
                      <Text style={[
                        styles.teamBtnText,
                        { color: disabled ? '#CBD5E1' : color },
                        active && styles.teamBtnTextActive,
                      ]}>
                        {t('manualTeams.teamBtn', { num: i + 1 })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 110 }}
      />

      <TouchableOpacity
        style={[styles.confirmBtn, !allTeamsFull && styles.confirmBtnDisabled, { bottom: 24 + insets.bottom }]}
        onPress={handleConfirm}
        disabled={!allTeamsFull}
      >
        {allTeamsFull
          ? (
            <View style={styles.confirmBtnContent}>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>{t('manualTeams.confirmBtn')}</Text>
            </View>
          )
          : <Text style={styles.confirmBtnText}>{t('manualTeams.slotsFooter', { count: slotsNeeded })}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  summaryChipLabel: { fontSize: 13, fontWeight: '700' },
  summaryChipCount: { fontSize: 16, fontWeight: '800' },

  counter: { color: '#64748B', fontSize: 13, fontWeight: '500', marginBottom: 10 },

  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  playerName: { fontSize: 15, fontWeight: '600', color: '#1E3A5F', flex: 1 },
  teamBtns: { flexDirection: 'row', gap: 6 },
  teamBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBtnText: { fontSize: 12, fontWeight: '700' },
  teamBtnTextActive: { color: '#fff' },

  confirmBtn: {
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
  confirmBtnDisabled: { backgroundColor: '#CBD5E1', elevation: 0, shadowOpacity: 0 },
  confirmBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
