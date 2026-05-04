import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share, Modal,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, Team } from '../types';
import StarRating from '../components/StarRating';
import { rematchTwoTeams } from '../utils/balancer';
import { updateDrawRecord, addDrawRecord, getHideRatings } from '../storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

type RouteProps = RouteProp<RootStackParamList, 'Teams'>;

const TEAM_COLORS = ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'];

interface SwapSelection {
  teamIndex: number;
  playerIndex: number;
}

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
  const { t } = useTranslation();

  const [currentTeams, setCurrentTeams] = useState<Team[]>(params.teams);
  const [mergeVisible, setMergeVisible] = useState(params.openMergeModal ?? false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hideRatings, setHideRatings] = useState(false);
  const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);

  const shareCardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getHideRatings().then(setHideRatings);
    }, [])
  );

  async function handleShare() {
    const text = `${t('teams.sharePrefix')}\n\n${formatTeamsForShare(currentTeams)}`;
    await Share.share({ message: text });
  }

  async function handleShareImage() {
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('teams.shareImageTitle') });
      }
    } catch {
      // silently fail if capture not supported
    }
  }

  function handlePlayerTap(teamIndex: number, playerIndex: number) {
    if (swapSelection === null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSwapSelection({ teamIndex, playerIndex });
      return;
    }

    const isSamePlayer = swapSelection.teamIndex === teamIndex && swapSelection.playerIndex === playerIndex;
    if (isSamePlayer) {
      setSwapSelection(null);
      return;
    }

    const isSameTeam = swapSelection.teamIndex === teamIndex;
    if (isSameTeam) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSwapSelection({ teamIndex, playerIndex });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    performSwap(teamIndex, playerIndex);
    setSwapSelection(null);
  }

  async function performSwap(targetTeamIndex: number, targetPlayerIndex: number) {
    if (!swapSelection) return;
    const { teamIndex: srcTeam, playerIndex: srcPlayer } = swapSelection;

    const updatedTeams = currentTeams.map(t => ({ ...t, players: [...t.players] }));
    const playerA = updatedTeams[srcTeam].players[srcPlayer];
    const playerB = updatedTeams[targetTeamIndex].players[targetPlayerIndex];

    updatedTeams[srcTeam].players[srcPlayer] = playerB;
    updatedTeams[targetTeamIndex].players[targetPlayerIndex] = playerA;
    updatedTeams[srcTeam].totalStars = updatedTeams[srcTeam].totalStars - playerA.level + playerB.level;
    updatedTeams[targetTeamIndex].totalStars = updatedTeams[targetTeamIndex].totalStars - playerB.level + playerA.level;

    setCurrentTeams(updatedTeams);
    await updateDrawRecord(params.peladaId, updatedTeams, params.historyIndex ?? 0);
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

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await addDrawRecord(params.peladaId, updatedTeams);
  }

  function openMergeModal() {
    setSelectedIds(new Set());
    setMergeVisible(true);
  }

  const swapHint = swapSelection
    ? t('teams.swapHintActive', { name: currentTeams[swapSelection.teamIndex]?.players[swapSelection.playerIndex]?.name })
    : t('teams.swapHintIdle');

  return (
    <View style={styles.container}>
      {swapSelection !== null && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText}>{swapHint}</Text>
          <TouchableOpacity onPress={() => setSwapSelection(null)}>
            <Text style={styles.swapCancel}>{t('teams.cancelSwap')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        {currentTeams.map((team, teamIndex) => (
          <View key={team.id} style={[styles.card, { borderLeftColor: TEAM_COLORS[teamIndex % TEAM_COLORS.length] }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.teamName, { color: TEAM_COLORS[teamIndex % TEAM_COLORS.length] }]}>
                {team.name}
              </Text>
              <Text style={styles.totalStars}>{team.totalStars} ★</Text>
            </View>
            {team.players.map((player, playerIndex) => {
              const isSelected =
                swapSelection?.teamIndex === teamIndex && swapSelection?.playerIndex === playerIndex;
              const isSwapTarget = swapSelection !== null && swapSelection.teamIndex !== teamIndex;
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerRow,
                    isSelected && styles.playerRowSelected,
                    isSwapTarget && styles.playerRowSwapTarget,
                  ]}
                  onPress={() => handlePlayerTap(teamIndex, playerIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>
                    {player.name}
                  </Text>
                  {!hideRatings && <StarRating value={player.level} readonly size={14} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Hidden capture view for image sharing */}
      <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
        <View style={styles.shareCardInner}>
          <Text style={styles.shareCardTitle}>{t('teams.shareCardTitle')}</Text>
          <Text style={styles.shareCardSub}>{t('teams.shareCardApp')}</Text>
          {currentTeams.map((team, index) => (
            <View key={team.id} style={[styles.shareTeam, { borderLeftColor: TEAM_COLORS[index % TEAM_COLORS.length] }]}>
              <Text style={[styles.shareTeamName, { color: TEAM_COLORS[index % TEAM_COLORS.length] }]}>
                {team.name}
              </Text>
              {shuffled(team.players).map(p => (
                <Text key={p.id} style={styles.sharePlayerName}>{p.name}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { bottom: 24 + insets.bottom }]}>
        <TouchableOpacity style={styles.btnMerge} onPress={openMergeModal}>
          <Feather name="shuffle" size={16} color="#1E3A5F" />
          <Text style={styles.btnMergeText}>{t('teams.rebalanceTeams')}</Text>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
            <Feather name="rotate-ccw" size={15} color="#1E3A5F" />
            <Text style={styles.btnSecondaryText}>{t('teams.redo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleShare}>
            <Feather name="send" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>{t('teams.text')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnImage} onPress={handleShareImage}>
            <Feather name="image" size={20} color="#1E3A5F" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Merge Modal */}
      <Modal visible={mergeVisible} transparent animationType="fade" onRequestClose={() => setMergeVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('teams.modalTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('teams.modalSubtitle')}</Text>

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
                        {t('teams.teamInfo', { count: team.players.length, stars: team.totalStars })}
                      </Text>
                    </View>
                    {isSelected && <Feather name="check" size={18} color={color} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnModalSecondary} onPress={() => setMergeVisible(false)}>
                <Text style={styles.btnModalSecondaryText}>{t('teams.cancelBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalPrimary, selectedIds.size !== 2 && styles.btnModalDisabled]}
                onPress={handleMergeConfirm}
                disabled={selectedIds.size !== 2}
              >
                <Text style={styles.btnModalPrimaryText}>{t('teams.redistributeBtn')}</Text>
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

  swapBanner: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  swapBannerText: { color: '#93C5FD', fontSize: 13, fontWeight: '500', flex: 1 },
  swapCancel: { color: '#fff', fontSize: 13, fontWeight: '700' },

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
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderRadius: 6,
  },
  playerRowSelected: { backgroundColor: '#DBEAFE', borderTopColor: 'transparent' },
  playerRowSwapTarget: { backgroundColor: '#F0FDF4' },
  playerName: { fontSize: 14, color: '#334155', fontWeight: '500' },
  playerNameSelected: { color: '#1E3A5F', fontWeight: '700' },

  footer: { position: 'absolute', bottom: 24, left: 16, right: 16, gap: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 15,
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 15,
  },
  btnSecondaryText: { color: '#1E3A5F', fontWeight: '600', fontSize: 15 },
  btnImage: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMerge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#1E3A5F',
    elevation: 2,
  },
  btnMergeText: { color: '#1E3A5F', fontWeight: '700', fontSize: 15 },

  shareCard: { position: 'absolute', left: -9999, top: 0 },
  shareCardInner: {
    backgroundColor: '#F0F4FF',
    padding: 20,
    width: 320,
    gap: 10,
  },
  shareCardTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A5F' },
  shareCardSub: { fontSize: 12, color: '#64748B', marginTop: -6 },
  shareTeam: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    gap: 4,
  },
  shareTeamName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sharePlayerName: { fontSize: 13, color: '#334155' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, gap: 14 },
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
  teamOptionDot: { width: 12, height: 12, borderRadius: 6 },
  teamOptionInfo: { flex: 1 },
  teamOptionName: { fontSize: 15, fontWeight: '600', color: '#1E3A5F' },
  teamOptionMeta: { fontSize: 12, color: '#64748B', marginTop: 1 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnModalPrimary: {
    flex: 1, backgroundColor: '#1E3A5F', borderRadius: 8, padding: 13, alignItems: 'center',
  },
  btnModalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnModalSecondary: {
    flex: 1, backgroundColor: '#E2E8F0', borderRadius: 8, padding: 13, alignItems: 'center',
  },
  btnModalSecondaryText: { color: '#1E3A5F', fontWeight: '600', fontSize: 15 },
  btnModalDisabled: { backgroundColor: '#CBD5E1' },
});
