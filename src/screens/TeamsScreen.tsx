import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, Share, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, Team, Player, StarLevel, Gender } from '../types';
import StarRating from '../components/StarRating';
import { rematchTwoTeams, recalcTeams } from '../utils/balancer';
import { updateDrawRecord, addDrawRecord, getHideRatings, getPeladaById } from '../storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme, ThemeColors } from '../theme';
import { formatStars, teamAverage } from '../utils/stars';
import { exportDrawToFile } from '../utils/drawShare';

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  const [shareMenuVisible, setShareMenuVisible] = useState(false);

  const [basePlayers, setBasePlayers] = useState<Player[]>([]);
  const [peladaName, setPeladaName] = useState<string>('');
  const [playersPerTeamCfg, setPlayersPerTeamCfg] = useState<number>(5);
  const [addPickerTeamIdx, setAddPickerTeamIdx] = useState<number | null>(null);
  const [guestModalTeamIdx, setGuestModalTeamIdx] = useState<number | null>(null);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestLevel, setNewGuestLevel] = useState<StarLevel>(3);
  const [newGuestGender, setNewGuestGender] = useState<Gender | undefined>(undefined);

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
      getPeladaById(params.peladaId).then(pelada => {
        if (pelada) {
          setBasePlayers(pelada.players);
          setPeladaName(pelada.name);
          setPlayersPerTeamCfg(pelada.playersPerTeam);
        }
      });
    }, [params.peladaId])
  );

  // Persists the current arrangement to the history record we're attached to.
  // historyIndex defaults to 0 — the most recent draw, which addDrawRecord
  // unshifts into the history when the screen is opened fresh.
  async function persistTeams(teams: Team[]) {
    await updateDrawRecord(params.peladaId, teams, params.historyIndex ?? 0);
  }

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
    await persistTeams(updatedTeams);
  }

  function handleRemovePlayer(teamIndex: number, playerIndex: number) {
    const player = currentTeams[teamIndex].players[playerIndex];
    Alert.alert(
      t('teams.removePlayerTitle'),
      t('teams.removePlayerMsg', { name: player.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => removePlayer(teamIndex, playerIndex),
        },
      ],
    );
  }

  async function removePlayer(teamIndex: number, playerIndex: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = currentTeams.map(t => ({ ...t, players: [...t.players] }));
    next[teamIndex].players.splice(playerIndex, 1);
    const recalced = recalcTeams(next);
    setCurrentTeams(recalced);
    if (swapSelection?.teamIndex === teamIndex) setSwapSelection(null);
    await persistTeams(recalced);
  }

  function openAddPicker(teamIndex: number) {
    setAddPickerTeamIdx(teamIndex);
  }

  async function addPlayerToTeam(player: Player, teamIndex: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = currentTeams.map(t => ({ ...t, players: [...t.players] }));
    next[teamIndex].players.push(player);
    const recalced = recalcTeams(next);
    setCurrentTeams(recalced);
    setAddPickerTeamIdx(null);
    await persistTeams(recalced);
  }

  function openGuestModal(teamIndex: number) {
    setAddPickerTeamIdx(null);
    setNewGuestName('');
    setNewGuestLevel(3);
    setNewGuestGender(undefined);
    setGuestModalTeamIdx(teamIndex);
  }

  async function confirmGuest() {
    if (guestModalTeamIdx === null) return;
    const name = newGuestName.trim();
    if (!name) return;
    const guest: Player = {
      id: generateId(),
      name,
      level: newGuestLevel,
      ...(newGuestGender ? { gender: newGuestGender } : {}),
    };
    const idx = guestModalTeamIdx;
    setGuestModalTeamIdx(null);
    await addPlayerToTeam(guest, idx);
  }

  // Players already placed in any team should not appear in the picker — even
  // if they're guests (they have unique ids).
  const placedIds = new Set(currentTeams.flatMap(t => t.players.map(p => p.id)));
  const availableBasePlayers = basePlayers.filter(p => !placedIds.has(p.id));

  async function handleShareText() {
    setShareMenuVisible(false);
    const text = `${t('teams.sharePrefix')}\n\n${formatTeamsForShare(currentTeams)}`;
    await Share.share({ message: text });
  }

  async function handleShareImage() {
    setShareMenuVisible(false);
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

  async function handleShareData() {
    setShareMenuVisible(false);
    try {
      await exportDrawToFile(
        {
          teams: currentTeams,
          timestamp: new Date().toISOString(),
          ...(params.balanceByGender ? { balanceByGender: true } : {}),
        },
        { name: peladaName || 'Pelada', playersPerTeam: playersPerTeamCfg },
        t('teams.shareDataTitle'),
      );
    } catch {
      // silently ignore — the user can retry from the menu
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

    const [newA, newB] = rematchTwoTeams(teamA, teamB, { balanceByGender: params.balanceByGender });
    const updatedTeams = currentTeams.map(t => {
      if (t.id === idA) return newA;
      if (t.id === idB) return newB;
      return t;
    });
    setCurrentTeams(updatedTeams);
    setSelectedIds(new Set());
    setMergeVisible(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await addDrawRecord(params.peladaId, updatedTeams, { balanceByGender: params.balanceByGender });
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
        <View style={styles.hintRow}>
          {params.balanceByGender && (
            <View style={styles.genderBadge}>
              <Feather name="users" size={11} color={colors.primary} />
              <Text style={styles.genderBadgeText}>{t('teams.genderBalancedBadge')}</Text>
            </View>
          )}
          <Text style={styles.hint}>{t('teams.swapHintIdle')}</Text>
        </View>
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
                <Text style={styles.totalStars}>{formatStars(teamAverage(team))} ★ {t('teams.avgSuffix')}</Text>
              </View>

              {team.players.map((player, playerIndex) => {
                const isSelected =
                  swapSelection?.teamIndex === teamIndex &&
                  swapSelection?.playerIndex === playerIndex;
                // Under the "sem-gênero = homem" rule, undefined gender gets
                // the male tint too whenever the draw is gender-balanced.
                const genderTint = params.balanceByGender
                  ? (player.gender === 'F' ? colors.genderTintFemale : colors.genderTintMale)
                  : undefined;

                return (
                  <View
                    key={player.id}
                    style={[
                      styles.playerRow,
                      genderTint ? { backgroundColor: genderTint } : null,
                      isSelected && styles.playerRowSelected,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.playerTapZone}
                      onPress={() => handlePlayerTap(teamIndex, playerIndex)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>
                        {player.name}
                      </Text>
                      {player.gender && (
                        <Text style={styles.playerGender}>
                          {player.gender === 'M' ? '♂' : '♀'}
                        </Text>
                      )}
                      {!hideRatings && <StarRating value={player.level} readonly size={14} />}
                      {isSelected
                        ? <Feather name="check-circle" size={14} color={colors.primary} />
                        : <Feather name="chevron-right" size={14} color={colors.border} />
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemovePlayer(teamIndex, playerIndex)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Feather name="x" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.addPlayerBtn, { borderColor: color }]}
                onPress={() => openAddPicker(teamIndex)}
                activeOpacity={0.7}
              >
                <Feather name="user-plus" size={14} color={color} />
                <Text style={[styles.addPlayerBtnText, { color }]}>{t('teams.addPlayer')}</Text>
              </TouchableOpacity>
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
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShareMenuVisible(true)}>
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>{t('teams.share')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Unified share menu */}
      <Modal visible={shareMenuVisible} transparent animationType="fade" onRequestClose={() => setShareMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShareMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.shareMenu}>
            <Text style={styles.modalTitle}>{t('teams.shareMenuTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('teams.shareMenuSubtitle')}</Text>
            <TouchableOpacity style={styles.shareOption} onPress={handleShareText}>
              <Feather name="message-square" size={18} color={colors.primary} />
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionLabel}>{t('teams.shareText')}</Text>
                <Text style={styles.shareOptionDesc}>{t('teams.shareTextDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareOption} onPress={handleShareImage}>
              <Feather name="image" size={18} color={colors.primary} />
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionLabel}>{t('teams.shareImage')}</Text>
                <Text style={styles.shareOptionDesc}>{t('teams.shareImageDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareOption} onPress={handleShareData}>
              <Feather name="file-text" size={18} color={colors.primary} />
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionLabel}>{t('teams.shareData')}</Text>
                <Text style={styles.shareOptionDesc}>{t('teams.shareDataDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Merge modal */}
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
                        {t('teams.teamInfo', { count: team.players.length, stars: formatStars(teamAverage(team)) })}
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

      {/* Add player picker */}
      <Modal
        visible={addPickerTeamIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddPickerTeamIdx(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>
              {addPickerTeamIdx !== null
                ? t('teams.addToTeam', { team: currentTeams[addPickerTeamIdx]?.name ?? '' })
                : ''}
            </Text>
            <Text style={styles.modalSubtitle}>{t('teams.addPickerSubtitle')}</Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {availableBasePlayers.length === 0 ? (
                <Text style={styles.emptyHint}>{t('teams.noAvailablePlayers')}</Text>
              ) : (
                availableBasePlayers.map(player => (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.pickerRow}
                    onPress={() => addPickerTeamIdx !== null && addPlayerToTeam(player, addPickerTeamIdx)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{player.name}</Text>
                      <View style={styles.pickerMeta}>
                        {!hideRatings && <StarRating value={player.level} readonly size={12} />}
                        {player.gender && (
                          <Text style={styles.pickerGender}>
                            {player.gender === 'M' ? '♂' : '♀'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Feather name="plus-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnModalSecondary} onPress={() => setAddPickerTeamIdx(null)}>
                <Text style={styles.btnModalSecondaryText}>{t('teams.cancelBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnModalPrimary}
                onPress={() => addPickerTeamIdx !== null && openGuestModal(addPickerTeamIdx)}
              >
                <Feather name="user-plus" size={14} color="#fff" />
                <Text style={styles.btnModalPrimaryText}>{t('teams.addGuest')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Guest add modal */}
      <Modal
        visible={guestModalTeamIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGuestModalTeamIdx(null)}
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('teams.addGuest')}</Text>
            <Text style={styles.modalSubtitle}>
              {guestModalTeamIdx !== null
                ? t('teams.guestForTeam', { team: currentTeams[guestModalTeamIdx]?.name ?? '' })
                : ''}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('playerList.guestName')}
              placeholderTextColor={colors.textMuted}
              value={newGuestName}
              onChangeText={setNewGuestName}
              autoFocus
            />
            <View style={styles.levelRow}>
              <Text style={styles.levelLabel}>{t('playerList.levelLabel')}</Text>
              <StarRating value={newGuestLevel} onChange={lvl => setNewGuestLevel(lvl)} size={26} />
            </View>
            <View style={styles.genderRow}>
              {([
                { value: undefined, key: 'none' },
                { value: 'M' as const, key: 'male' },
                { value: 'F' as const, key: 'female' },
              ]).map(opt => {
                const active = newGuestGender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.genderBtn, active && styles.genderBtnActive]}
                    onPress={() => setNewGuestGender(opt.value)}
                  >
                    <Text style={[styles.genderBtnText, active && styles.genderBtnTextActive]}>
                      {t(`playerRegister.gender.${opt.key}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnModalSecondary} onPress={() => setGuestModalTeamIdx(null)}>
                <Text style={styles.btnModalSecondaryText}>{t('teams.cancelBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalPrimary, !newGuestName.trim() && styles.btnModalDisabled]}
                onPress={confirmGuest}
                disabled={!newGuestName.trim()}
              >
                <Text style={styles.btnModalPrimaryText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    hintRow: { alignItems: 'center', paddingVertical: 6, gap: 4 },
    hint: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
    },
    genderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    genderBadgeText: { fontSize: 11, fontWeight: '700', color: c.primary },
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
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      borderRadius: 6,
    },
    playerTapZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    playerRowSelected: {
      backgroundColor: c.primaryLight,
      borderTopColor: 'transparent',
    },
    playerName: { fontSize: 14, color: c.text, fontWeight: '500', flex: 1 },
    playerNameSelected: { color: c.primary, fontWeight: '700' },
    playerGender: { fontSize: 13, color: c.textSecondary, fontWeight: '700' },
    removeBtn: { paddingHorizontal: 6, paddingVertical: 6 },

    addPlayerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    addPlayerBtnText: { fontWeight: '700', fontSize: 13 },

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
    shareMenu: { backgroundColor: c.surface, borderRadius: 16, padding: 20, gap: 10 },
    shareOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: c.surfaceVariant,
    },
    shareOptionText: { flex: 1 },
    shareOptionLabel: { fontSize: 15, fontWeight: '700', color: c.text },
    shareOptionDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

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

    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
      marginBottom: 6,
    },
    pickerName: { fontSize: 14, fontWeight: '600', color: c.text },
    pickerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    pickerGender: { fontSize: 12, color: c.textSecondary, fontWeight: '700' },
    emptyHint: { fontSize: 13, color: c.textSecondary, textAlign: 'center', paddingVertical: 24 },

    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 11,
      fontSize: 15,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    levelLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    genderRow: { flexDirection: 'row', gap: 8 },
    genderBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      backgroundColor: c.surfaceVariant,
    },
    genderBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    genderBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    genderBtnTextActive: { color: c.primary, fontWeight: '700' },

    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnModalPrimary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: c.primary, borderRadius: 8, padding: 13,
    },
    btnModalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    btnModalSecondary: {
      flex: 1, backgroundColor: c.borderLight, borderRadius: 8, padding: 13, alignItems: 'center',
    },
    btnModalSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },
    btnModalDisabled: { backgroundColor: c.disabled },
  });
}
