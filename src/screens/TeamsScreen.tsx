import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share, Modal,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Team } from '../types';
import StarRating from '../components/StarRating';
import { rematchTwoTeams } from '../utils/balancer';
import { updateDrawRecord, getHideRatings } from '../storage';

type RouteProps = RouteProp<RootStackParamList, 'Teams'>;

const TEAM_COLORS = ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTeamsForShare(teams: Team[]): string {
  return teams.map(team => {
    const players = shuffled(team.players).map(p => `  ${p.name}`).join('\n');
    return `${team.name}\n${players}`;
  }).join('\n\n');
}

export default function TeamsScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation();

  const [currentTeams, setCurrentTeams] = useState<Team[]>(params.teams);
  const [mergeVisible, setMergeVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hideRatings, setHideRatings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getHideRatings().then(setHideRatings);
    }, [])
  );

  async function handleShare() {
    const text = `⚽ Times Sorteados — BalanceSquad\n\n${formatTeamsForShare(currentTeams)}`;
    await Share.share({ message: text });
  }

  function toggleTeamSelection(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size === 2) {
          const [first] = next;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  }

  async function handleMergeConfirm() {
    if (selectedIds.size !== 2) return;
    const [idA, idB] = [...selectedIds];
    const teamA = currentTeams.find(t => t.id === idA);
    const teamB = currentTeams.find(t => t.id === idB);
    if (!teamA || !teamB) return;

    const [newA, newB] = rematchTwoTeams(teamA, teamB);
    const updatedTeams = currentTeams.map(t => {
      if (t.id === idA) return newA;
      if (t.id === idB) return newB;
      return t;
    });
    setCurrentTeams(updatedTeams);
    setSelectedIds(new Set());
    setMergeVisible(false);

    await updateDrawRecord(params.peladaId, updatedTeams, params.historyIndex ?? 0);
  }

  function openMergeModal() {
    setSelectedIds(new Set());
    setMergeVisible(true);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {currentTeams.map((team, index) => (
          <View key={team.id} style={[styles.card, { borderLeftColor: TEAM_COLORS[index % TEAM_COLORS.length] }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.teamName, { color: TEAM_COLORS[index % TEAM_COLORS.length] }]}>
                {team.name}
              </Text>
              <Text style={styles.totalStars}>{team.totalStars} ★</Text>
            </View>
            {team.players.map(player => (
              <View key={player.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{player.name}</Text>
                {!hideRatings && <StarRating value={player.level} readonly size={14} />}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnMerge} onPress={openMergeModal}>
          <Text style={styles.btnMergeText}>🔀  Mesclar Times</Text>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
            <Text style={styles.btnSecondaryText}>↩  Refazer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleShare}>
            <Text style={styles.btnPrimaryText}>📤  Compartilhar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Merge Modal */}
      <Modal visible={mergeVisible} transparent animationType="fade" onRequestClose={() => setMergeVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mesclar Times</Text>
            <Text style={styles.modalSubtitle}>
              Selecione 2 times para redistribuir os jogadores
            </Text>

            <View style={styles.teamList}>
              {currentTeams.map((team, index) => {
                const isSelected = selectedIds.has(team.id);
                const color = TEAM_COLORS[index % TEAM_COLORS.length];
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamOption, isSelected && { borderColor: color, backgroundColor: '#EEF2FF' }]}
                    onPress={() => toggleTeamSelection(team.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.teamOptionDot, { backgroundColor: isSelected ? color : '#CBD5E1' }]} />
                    <View style={styles.teamOptionInfo}>
                      <Text style={[styles.teamOptionName, isSelected && { color }]}>
                        {team.name}
                      </Text>
                      <Text style={styles.teamOptionMeta}>
                        {team.players.length} jogadores · {team.totalStars}★
                      </Text>
                    </View>
                    {isSelected && <Text style={[styles.checkMark, { color }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnModalSecondary} onPress={() => setMergeVisible(false)}>
                <Text style={styles.btnModalSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalPrimary, selectedIds.size !== 2 && styles.btnModalDisabled]}
                onPress={handleMergeConfirm}
                disabled={selectedIds.size !== 2}
              >
                <Text style={styles.btnModalPrimaryText}>Redistribuir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamName: { fontSize: 17, fontWeight: '700' },
  totalStars: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  playerName: { fontSize: 14, color: '#334155', fontWeight: '500' },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 2,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#1E3A5F', fontWeight: '600', fontSize: 15 },
  btnMerge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E3A5F',
    elevation: 2,
  },
  btnMergeText: { color: '#1E3A5F', fontWeight: '700', fontSize: 15 },

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
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: -6 },
  teamList: { gap: 8 },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  teamOptionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  teamOptionInfo: { flex: 1 },
  teamOptionName: { fontSize: 15, fontWeight: '600', color: '#1E3A5F' },
  teamOptionMeta: { fontSize: 12, color: '#64748B', marginTop: 1 },
  checkMark: { fontSize: 18, fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnModalPrimary: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  btnModalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnModalSecondary: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
  },
  btnModalSecondaryText: { color: '#1E3A5F', fontWeight: '600', fontSize: 15 },
  btnModalDisabled: { backgroundColor: '#94A3B8' },
});
