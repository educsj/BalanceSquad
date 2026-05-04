import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
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
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'Teams'>;

type SwapSelection = { teamIndex: number; playerIndex: number } | null;

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const TEAM_COLORS = colors.teamColors;

  const [currentTeams, setCurrentTeams] = useState<Team[]>(params.teams);
  const [mergeVisible, setMergeVisible] = useState(params.openMergeModal ?? false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hideRatings, setHideRatings] = useState(false);
  const [swapSelection, setSwapSelection] = useState<SwapSelection>(null);

  const shareCardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  // Entrance animations — one Animated.Value per team card, initialised once
  const teamAnims = useRef<Animated.Value[]>([]);
  if (teamAnims.current.length === 0) {
    teamAnims.current = params.teams.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    Animated.stagger(
      100,
      teamAnims.current.map(anim =>
        Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true })
      ),
    ).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getHideRatings().then(setHideRatings);
    }, [])
  );

  function handlePlayerTap(teamIndex: number, playerIndex: number) {
    if (!swapSelection) {
      setSwapSelection({ teamIndex, playerIndex });
      Haptics.selectionAsync().catch(() => {});
      return;
    }

    if (swapSelection.teamIndex === teamIndex && swapSelection.playerIndex === playerIndex) {
      setSwapSelection(null);
      return;
    }

    if (swapSelection.teamIndex === teamIndex) {
      setSwapSelection({ teamIndex, playerIndex });
      return;
    }

    performSwap(swapSelection.teamIndex, swapSelection.playerIndex, teamIndex, playerIndex);
    setSwapSelection(null);
  }

  async function performSwap(
    srcTeamIdx: number, srcPlayerIdx: number,
    tgtTeamIdx: number, tgtPlayerIdx: number,
  ) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const updatedTeams = currentTeams.map(t => ({ ...t, players: [...t.players] }));
    const playerA = updatedTeams[srcTeamIdx].players[srcPlayerIdx];
    const playerB = updatedTeams[tgtTeamIdx].players[tgtPlayerIdx];

    updatedTeams[srcTeamIdx].players[srcPlayerIdx] = playerB;
    updatedTeams[tgtTeamIdx].players[tgtPlayerIdx] = playerA;
    updatedTeams[srcTeamIdx].totalStars = updatedTeams[srcTeamIdx].totalStars - playerA.level + playerB.level;
    updatedTeams[tgtTeamIdx].totalStars = updatedTeams[tgtTeamIdx].totalStars - playerB.level + playerA.level;

    setCurrentTeams(updatedTeams);
    await updateDrawRecord(params.peladaId, updatedTeams, params.historyIndex ?? 0);
  }

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
      // silently ignore share failures
    }
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

  const selectedPlayerName = swapSelection
    ? currentTeams[swapSelection.teamIndex]?.players[swapSelection.playerIndex]?.name ?? ''
    : '';

  return (
    <View style={styles.container}>
      {swapSelection ? (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText} numberOfLines={1}>
            {t('teams.swapHintActive', { name: selectedPlayerName })}
          </Text>
          <TouchableOpacity onPress={() => setSwapSelection(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.swapBannerCancel}>{t('teams.cancelSwap')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hint}>{t('teams.swapHintIdle')}</Text>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        {currentTeams.map((team, teamIndex) => {
          const color = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
          const anim = teamAnims.current[teamIndex] ?? new Animated.Value(1);
          const cardAnimStyle = {
            opacity: anim,
            transform: [{
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
            }],
          };

          return (
            <Animated.View
              key={team.id}
              style={[styles.card, { borderLeftColor: color }, cardAnimStyle]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.teamName, { color }]}>{team.name}</Text>
                <Text style={styles.totalStars}>{team.totalStars} ★</Text>
              </View>

              {team.players.map((player, playerIndex) => {
                const isSelected =
                  swapSelection?.teamIndex === teamIndex &&
                  swapSelection?.playerIndex === playerIndex;

                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                    onPress={() => handlePlayerTap(teamIndex, playerIndex)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>
                      {player.name}
                    </Text>
                    {!hideRatings && <StarRating value={player.level} readonly size={14} />}
                    {isSelected
                      ? <Feather name="check-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                      : <Feather name="chevron-right" size={14} color={colors.border} style={{ marginLeft: 4 }} />
                    }
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Hidden card for image share */}
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
          <Feather name="shuffle" size={16} color={colors.primary} />
          <Text style={styles.btnMergeText}>{t('teams.rebalanceTeams')}</Text>
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
            <Feather name="rotate-ccw" size={15} color={colors.primary} />
            <Text style={styles.btnSecondaryText}>{t('teams.redo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleShare}>
            <Feather name="send" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>{t('teams.text')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnImage} onPress={handleShareImage}>
            <Feather name="image" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
                    style={[styles.teamOption, isSelected && { borderColor: color, backgroundColor: colors.primaryLight }]}
                    onPress={() => toggleTeamSelection(team.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.teamOptionDot, { backgroundColor: isSelected ? color : colors.border }]} />
                    <View style={styles.teamOptionInfo}>
                      <Text style={[styles.teamOptionName, isSelected && { color }]}>{team.name}</Text>
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

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    hint: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: 6,
    },
    swapBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: c.primaryLight,
      gap: 8,
    },
    swapBannerText: { flex: 1, color: c.primary, fontWeight: '600', fontSize: 13 },
    swapBannerCancel: { color: c.primary, fontWeight: '700', fontSize: 13 },

    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderLeftWidth: 5,
      borderWidth: 2,
      borderColor: 'transparent',
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
    totalStars: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },

    playerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      borderRadius: 6,
    },
    playerRowSelected: {
      backgroundColor: c.primaryLight,
      borderTopColor: 'transparent',
    },
    playerName: { fontSize: 14, color: c.text, fontWeight: '500', flex: 1 },
    playerNameSelected: { color: c.primary, fontWeight: '700' },

    footer: { position: 'absolute', left: 16, right: 16, gap: 8 },
    footerRow: { flexDirection: 'row', gap: 8 },
    btnPrimary: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
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
      backgroundColor: c.borderLight,
      borderRadius: 12,
      padding: 15,
    },
    btnSecondaryText: { color: c.primary, fontWeight: '600', fontSize: 15 },
    btnImage: {
      backgroundColor: c.borderLight,
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
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 2,
      borderColor: c.primary,
      elevation: 2,
    },
    btnMergeText: { color: c.primary, fontWeight: '700', fontSize: 15 },

    shareCard: { position: 'absolute', left: -9999, top: 0 },
    shareCardInner: { backgroundColor: '#F0F4FF', padding: 20, width: 320, gap: 10 },
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
    modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 14 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    modalSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: -6 },
    teamList: { gap: 8 },
    teamOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    teamOptionDot: { width: 12, height: 12, borderRadius: 6 },
    teamOptionInfo: { flex: 1 },
    teamOptionName: { fontSize: 15, fontWeight: '600', color: c.text },
    teamOptionMeta: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnModalPrimary: {
      flex: 1, backgroundColor: c.primary, borderRadius: 8, padding: 13, alignItems: 'center',
    },
    btnModalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    btnModalSecondary: {
      flex: 1, backgroundColor: c.borderLight, borderRadius: 8, padding: 13, alignItems: 'center',
    },
    btnModalSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },
    btnModalDisabled: { backgroundColor: c.disabled },
  });
}
