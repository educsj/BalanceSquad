import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share, Modal,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { RootStackParamList, Team } from '../types';
import StarRating from '../components/StarRating';
import { rematchTwoTeams } from '../utils/balancer';
import { updateDrawRecord, addDrawRecord, getHideRatings } from '../storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'Teams'>;

type DragInfo = {
  srcTeam: number;
  srcPlayer: number;
  name: string;
} | null;

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

function heavyHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
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
  const [dragInfo, setDragInfo] = useState<DragInfo>(null);
  const [hoverTeamIdx, setHoverTeamIdx] = useState<number | null>(null);

  const shareCardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const scrollContainerY = useRef(0);
  const teamLayouts = useRef<Array<{ y: number; height: number } | null>>([]);

  // Reanimated values for drag overlay
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragOpacity = useSharedValue(0);

  const dragOverlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - 80 },
      { translateY: dragY.value - 24 },
      { scale: dragScale.value },
    ],
    opacity: dragOpacity.value,
  }));

  useFocusEffect(
    useCallback(() => {
      getHideRatings().then(setHideRatings);
    }, [])
  );

  function measureScrollContainer() {
    (scrollRef.current as any)?.measure(
      (_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
        scrollContainerY.current = pageY;
      }
    );
  }

  function findTargetTeam(absoluteY: number): number | null {
    const relY = absoluteY - scrollContainerY.current + scrollY.current;
    for (let i = 0; i < currentTeams.length; i++) {
      const l = teamLayouts.current[i];
      if (l && relY >= l.y && relY <= l.y + l.height) return i;
    }
    return null;
  }

  function updateHover(absoluteY: number) {
    setHoverTeamIdx(findTargetTeam(absoluteY));
  }

  function executeDrop(srcTeam: number, srcPlayer: number, absoluteY: number) {
    const targetTeam = findTargetTeam(absoluteY);
    if (targetTeam === null || targetTeam === srcTeam) return;
    const targetPlayerIdx = Math.min(srcPlayer, currentTeams[targetTeam].players.length - 1);
    performSwap(srcTeam, srcPlayer, targetTeam, targetPlayerIdx);
  }

  function endDrag(srcTeam: number, srcPlayer: number, absoluteY: number) {
    executeDrop(srcTeam, srcPlayer, absoluteY);
    setDragInfo(null);
    setHoverTeamIdx(null);
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
      // silently fail
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

  return (
    <View style={styles.container}>
      {/* Drag hint */}
      {!dragInfo && (
        <Text style={styles.dragHint}>
          <Feather name="move" size={12} color={colors.textMuted} /> {t('teams.dragHint')}
        </Text>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 180 }}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        onLayout={measureScrollContainer}
        scrollEnabled={dragInfo === null}
      >
        {currentTeams.map((team, teamIndex) => {
          const color = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
          const isHovered = hoverTeamIdx === teamIndex && dragInfo !== null;
          return (
            <Animated.View
              key={team.id}
              entering={FadeInDown.delay(teamIndex * 100).springify().damping(14)}
              onLayout={e => {
                teamLayouts.current[teamIndex] = {
                  y: e.nativeEvent.layout.y,
                  height: e.nativeEvent.layout.height,
                };
              }}
              style={[
                styles.card,
                { borderLeftColor: color },
                isHovered && { backgroundColor: colors.primaryLight, borderColor: color },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.teamName, { color }]}>{team.name}</Text>
                <Text style={styles.totalStars}>{team.totalStars} ★</Text>
              </View>
              {team.players.map((player, playerIndex) => {
                const isDragging = dragInfo?.srcTeam === teamIndex && dragInfo?.srcPlayer === playerIndex;

                const gesture = Gesture.Pan()
                  .activateAfterLongPress(400)
                  .onBegin(e => {
                    dragX.value = e.absoluteX;
                    dragY.value = e.absoluteY;
                    dragScale.value = withSpring(1.06);
                    dragOpacity.value = withTiming(1, { duration: 150 });
                    runOnJS(heavyHaptic)();
                    runOnJS(setDragInfo)({ srcTeam: teamIndex, srcPlayer: playerIndex, name: player.name });
                  })
                  .onChange(e => {
                    dragX.value = e.absoluteX;
                    dragY.value = e.absoluteY;
                    runOnJS(updateHover)(e.absoluteY);
                  })
                  .onEnd(e => {
                    dragOpacity.value = withTiming(0, { duration: 120 });
                    dragScale.value = withSpring(1);
                    runOnJS(endDrag)(teamIndex, playerIndex, e.absoluteY);
                  })
                  .onFinalize(() => {
                    dragOpacity.value = withTiming(0, { duration: 120 });
                    dragScale.value = withSpring(1);
                    runOnJS(setDragInfo)(null);
                    runOnJS(setHoverTeamIdx)(null);
                  });

                return (
                  <GestureDetector key={player.id} gesture={gesture}>
                    <Animated.View
                      style={[
                        styles.playerRow,
                        isDragging && styles.playerRowDragging,
                        isHovered && !isDragging && styles.playerRowHoverTarget,
                      ]}
                    >
                      <Text style={[styles.playerName, isDragging && styles.playerNameDragging]}>
                        {player.name}
                      </Text>
                      {!hideRatings && <StarRating value={player.level} readonly size={14} />}
                      <Feather name="menu" size={14} color={colors.border} style={{ marginLeft: 4 }} />
                    </Animated.View>
                  </GestureDetector>
                );
              })}
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Floating drag overlay */}
      {dragInfo && (
        <Animated.View style={[styles.dragOverlay, dragOverlayStyle]} pointerEvents="none">
          <Text style={styles.dragOverlayText}>{dragInfo.name}</Text>
        </Animated.View>
      )}

      {/* Hidden image capture view */}
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

      {/* Rebalance Modal */}
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

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    dragHint: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: 6,
      paddingHorizontal: 16,
    },

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
    playerRowDragging: {
      opacity: 0.35,
      backgroundColor: c.primaryLight,
    },
    playerRowHoverTarget: {
      backgroundColor: c.primaryLight,
      borderTopColor: 'transparent',
    },
    playerName: { fontSize: 14, color: c.text, fontWeight: '500', flex: 1 },
    playerNameDragging: { color: c.textMuted },

    dragOverlay: {
      position: 'absolute',
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      zIndex: 999,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      width: 160,
    },
    dragOverlayText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    footer: { position: 'absolute', bottom: 24, left: 16, right: 16, gap: 8 },
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
