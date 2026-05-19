import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, Team, Match, MatchResult, GoalEntry } from '../types';
import { getPeladaById, addMatch, updateMatch } from '../storage';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'MatchEditor'>;
type Nav = StackNavigationProp<RootStackParamList>;

type Side = 'home' | 'away';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function MatchEditorScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const TEAM_COLORS = colors.teamColors;

  const isEdit = !!params.matchId;

  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);
  const [homePlayerIds, setHomePlayerIds] = useState<Set<string>>(new Set());
  const [awayPlayerIds, setAwayPlayerIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<MatchResult | null>(null);
  const [expandedSide, setExpandedSide] = useState<Side | null>(null);
  const [createdAt, setCreatedAt] = useState<string>('');
  const [goalsByPlayer, setGoalsByPlayer] = useState<Map<string, number>>(new Map());
  const [mvpPlayerId, setMvpPlayerId] = useState<string | undefined>(undefined);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [mvpExpanded, setMvpExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(p => {
        if (!p) return;
        const rec = (p.drawHistory ?? [])[params.historyIndex];
        if (!rec) return;
        setTeams(rec.teams);

        const existing = params.matchId
          ? (rec.matches ?? []).find(m => m.id === params.matchId)
          : undefined;

        if (existing) {
          setHomeTeamId(existing.homeTeamId);
          setAwayTeamId(existing.awayTeamId);
          setHomePlayerIds(new Set(existing.homePlayerIds));
          setAwayPlayerIds(new Set(existing.awayPlayerIds));
          setResult(existing.result);
          setCreatedAt(existing.timestamp);
          const goalsMap = new Map<string, number>();
          (existing.goals ?? []).forEach(g => goalsMap.set(g.playerId, g.count));
          setGoalsByPlayer(goalsMap);
          setMvpPlayerId(existing.mvpPlayerId);
        } else if (rec.teams.length >= 2 && homeTeamId === null) {
          // Sensible defaults: first two teams, full roster from each.
          const h = rec.teams[0];
          const a = rec.teams[1];
          setHomeTeamId(h.id);
          setAwayTeamId(a.id);
          setHomePlayerIds(new Set(h.players.map(p => p.id)));
          setAwayPlayerIds(new Set(a.players.map(p => p.id)));
        }
      });
    }, [params.peladaId, params.historyIndex, params.matchId])
  );

  function pickTeam(side: Side, teamId: number) {
    if (side === 'home') {
      if (awayTeamId === teamId) setAwayTeamId(homeTeamId);
      setHomeTeamId(teamId);
      const t = teams.find(x => x.id === teamId);
      if (t) setHomePlayerIds(new Set(t.players.map(p => p.id)));
    } else {
      if (homeTeamId === teamId) setHomeTeamId(awayTeamId);
      setAwayTeamId(teamId);
      const t = teams.find(x => x.id === teamId);
      if (t) setAwayPlayerIds(new Set(t.players.map(p => p.id)));
    }
  }

  function togglePlayer(side: Side, playerId: string) {
    const set = side === 'home' ? new Set(homePlayerIds) : new Set(awayPlayerIds);
    const other = side === 'home' ? awayPlayerIds : homePlayerIds;
    if (set.has(playerId)) {
      set.delete(playerId);
    } else {
      // A player can only be on one side of the same match.
      if (other.has(playerId)) {
        const otherSet = new Set(other);
        otherSet.delete(playerId);
        if (side === 'home') setAwayPlayerIds(otherSet);
        else setHomePlayerIds(otherSet);
      }
      set.add(playerId);
    }
    if (side === 'home') setHomePlayerIds(set);
    else setAwayPlayerIds(set);
  }

  const homeTeam = teams.find(t => t.id === homeTeamId);
  const awayTeam = teams.find(t => t.id === awayTeamId);
  const restingTeams = teams.filter(t => t.id !== homeTeamId && t.id !== awayTeamId);

  // Players available for swapping in: union of every team's roster.
  const allPlayers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; teamId: number }>();
    teams.forEach(t => {
      t.players.forEach(p => map.set(p.id, { id: p.id, name: p.name, teamId: t.id }));
    });
    return [...map.values()];
  }, [teams]);

  const canSave =
    homeTeamId !== null
    && awayTeamId !== null
    && homeTeamId !== awayTeamId
    && homePlayerIds.size > 0
    && awayPlayerIds.size > 0
    && result !== null;

  async function handleSave() {
    if (!canSave || homeTeamId === null || awayTeamId === null || !result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const goalsArr: GoalEntry[] = [];
    goalsByPlayer.forEach((count, playerId) => {
      if (count > 0) goalsArr.push({ playerId, count });
    });
    const match: Match = {
      id: params.matchId ?? generateId(),
      timestamp: createdAt || new Date().toISOString(),
      homeTeamId,
      awayTeamId,
      homePlayerIds: [...homePlayerIds],
      awayPlayerIds: [...awayPlayerIds],
      result,
      ...(goalsArr.length > 0 ? { goals: goalsArr } : {}),
      ...(mvpPlayerId ? { mvpPlayerId } : {}),
    };
    if (isEdit) await updateMatch(params.peladaId, params.historyIndex, match);
    else await addMatch(params.peladaId, params.historyIndex, match);
    navigation.goBack();
  }

  // Players in the match (both sides) — they can score and be MVP.
  const matchPlayerIds = useMemo(
    () => [...new Set([...homePlayerIds, ...awayPlayerIds])],
    [homePlayerIds, awayPlayerIds],
  );

  function adjustGoal(playerId: string, delta: number) {
    setGoalsByPlayer(prev => {
      const next = new Map(prev);
      const cur = next.get(playerId) ?? 0;
      const newVal = Math.max(0, cur + delta);
      if (newVal === 0) next.delete(playerId);
      else next.set(playerId, newVal);
      return next;
    });
  }

  const totalGoals = useMemo(() => {
    let sum = 0;
    goalsByPlayer.forEach(c => { sum += c; });
    return sum;
  }, [goalsByPlayer]);

  const mvpName = useMemo(() => {
    if (!mvpPlayerId) return null;
    const p = allPlayers.find(pl => pl.id === mvpPlayerId);
    return p?.name ?? null;
  }, [mvpPlayerId, allPlayers]);

  function renderTeamPicker(side: Side) {
    const selectedId = side === 'home' ? homeTeamId : awayTeamId;
    return (
      <View style={styles.teamPickerRow}>
        {teams.map((tm, idx) => {
          const active = selectedId === tm.id;
          const color = TEAM_COLORS[idx % TEAM_COLORS.length];
          return (
            <TouchableOpacity
              key={tm.id}
              style={[
                styles.teamPickerBtn,
                active && { borderColor: color, backgroundColor: colors.primaryLight },
              ]}
              onPress={() => pickTeam(side, tm.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.teamPickerText, active && { color, fontWeight: '700' }]} numberOfLines={1}>
                {tm.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderLineup(side: Side) {
    const team = side === 'home' ? homeTeam : awayTeam;
    const selected = side === 'home' ? homePlayerIds : awayPlayerIds;
    const teamLabel = team?.name ?? '—';
    const expanded = expandedSide === side;

    return (
      <View style={styles.lineupCard}>
        <TouchableOpacity
          style={styles.lineupHeader}
          onPress={() => setExpandedSide(expanded ? null : side)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.lineupTitle}>
              {t('matchEditor.lineupOf', { team: teamLabel })}
            </Text>
            <Text style={styles.lineupSub}>
              {t('matchEditor.playersOnField', { count: selected.size })}
            </Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.lineupBody}>
            <Text style={styles.lineupHint}>{t('matchEditor.lineupHint')}</Text>
            {allPlayers.map(p => {
              const isOn = selected.has(p.id);
              const onOtherSide = (side === 'home' ? awayPlayerIds : homePlayerIds).has(p.id);
              const isFromTeam = team?.players.some(tp => tp.id === p.id) ?? false;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.lineupPlayerRow,
                    isOn && styles.lineupPlayerRowOn,
                  ]}
                  onPress={() => togglePlayer(side, p.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                    {isOn && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.lineupPlayerName, isOn && styles.lineupPlayerNameOn]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {!isFromTeam && (
                    <Text style={styles.lineupPlayerBadge}>
                      {onOtherSide && !isOn
                        ? t('matchEditor.onOtherSide')
                        : t('matchEditor.borrowed')}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  if (teams.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>{t('matchEditor.notEnoughTeams')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.sectionLabel}>{t('matchEditor.homeTeam')}</Text>
        {renderTeamPicker('home')}

        <Text style={styles.versus}>×</Text>

        <Text style={styles.sectionLabel}>{t('matchEditor.awayTeam')}</Text>
        {renderTeamPicker('away')}

        {restingTeams.length > 0 && (
          <View style={styles.restingPill}>
            <Feather name="coffee" size={12} color={colors.textMuted} />
            <Text style={styles.restingText}>
              {t('matchEditor.resting', { names: restingTeams.map(r => r.name).join(', ') })}
            </Text>
          </View>
        )}

        <View style={{ height: 14 }} />
        {renderLineup('home')}
        {renderLineup('away')}

        {/* Goals */}
        <TouchableOpacity
          style={styles.lineupCard}
          onPress={() => setGoalsExpanded(v => !v)}
          activeOpacity={0.85}
        >
          <View style={styles.lineupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineupTitle}>{t('matchEditor.goalsTitle')}</Text>
              <Text style={styles.lineupSub}>
                {t('matchEditor.goalsSummary', { count: totalGoals })}
              </Text>
            </View>
            <Feather name={goalsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {goalsExpanded && (
          <View style={styles.expandedSection}>
            <Text style={styles.lineupHint}>{t('matchEditor.goalsHint')}</Text>
            {matchPlayerIds.length === 0 ? (
              <Text style={styles.lineupHint}>{t('matchEditor.noPlayersForGoals')}</Text>
            ) : (
              matchPlayerIds.map(pid => {
                const player = allPlayers.find(pl => pl.id === pid);
                if (!player) return null;
                const count = goalsByPlayer.get(pid) ?? 0;
                return (
                  <View key={pid} style={styles.goalRow}>
                    <Text style={styles.goalName} numberOfLines={1}>{player.name}</Text>
                    <View style={styles.goalControls}>
                      <TouchableOpacity
                        style={[styles.goalBtn, count === 0 && styles.goalBtnDisabled]}
                        onPress={() => adjustGoal(pid, -1)}
                        disabled={count === 0}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Feather name="minus" size={14} color={count === 0 ? colors.disabled : colors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.goalCount}>{count}</Text>
                      <TouchableOpacity
                        style={styles.goalBtn}
                        onPress={() => adjustGoal(pid, 1)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Feather name="plus" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* MVP */}
        <TouchableOpacity
          style={styles.lineupCard}
          onPress={() => setMvpExpanded(v => !v)}
          activeOpacity={0.85}
        >
          <View style={styles.lineupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineupTitle}>{t('matchEditor.mvpTitle')}</Text>
              <Text style={styles.lineupSub}>
                {mvpName ?? t('matchEditor.mvpNone')}
              </Text>
            </View>
            <Feather name={mvpExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {mvpExpanded && (
          <View style={styles.expandedSection}>
            <Text style={styles.lineupHint}>{t('matchEditor.mvpHint')}</Text>
            <View style={styles.mvpGrid}>
              <TouchableOpacity
                style={[styles.mvpOption, !mvpPlayerId && styles.mvpOptionActive]}
                onPress={() => setMvpPlayerId(undefined)}
              >
                <Text style={[styles.mvpOptionText, !mvpPlayerId && styles.mvpOptionTextActive]}>
                  {t('matchEditor.mvpNone')}
                </Text>
              </TouchableOpacity>
              {matchPlayerIds.map(pid => {
                const player = allPlayers.find(pl => pl.id === pid);
                if (!player) return null;
                const active = mvpPlayerId === pid;
                return (
                  <TouchableOpacity
                    key={pid}
                    style={[styles.mvpOption, active && styles.mvpOptionActive]}
                    onPress={() => setMvpPlayerId(pid)}
                  >
                    {active && <Feather name="star" size={12} color={colors.primary} />}
                    <Text style={[styles.mvpOptionText, active && styles.mvpOptionTextActive]} numberOfLines={1}>
                      {player.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('matchEditor.result')}</Text>
        <View style={styles.resultRow}>
          <TouchableOpacity
            style={[
              styles.resultBtn,
              result?.type === 'win' && result.winner === 'home' && styles.resultBtnActive,
            ]}
            onPress={() => setResult({ type: 'win', winner: 'home' })}
          >
            <Text style={styles.resultBtnLabel} numberOfLines={1}>
              {t('matchEditor.homeWon', { name: homeTeam?.name ?? '' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.resultBtn,
              result?.type === 'draw' && styles.resultBtnActive,
            ]}
            onPress={() => setResult({ type: 'draw' })}
          >
            <Text style={styles.resultBtnLabel}>{t('matches.draw')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.resultBtn,
              result?.type === 'win' && result.winner === 'away' && styles.resultBtnActive,
            ]}
            onPress={() => setResult({ type: 'win', winner: 'away' })}
          >
            <Text style={styles.resultBtnLabel} numberOfLines={1}>
              {t('matchEditor.awayWon', { name: awayTeam?.name ?? '' })}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.saveBtn,
          !canSave && styles.saveBtnDisabled,
          { bottom: 24 + insets.bottom },
        ]}
        onPress={handleSave}
        disabled={!canSave}
        activeOpacity={0.85}
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.saveBtnText}>
          {isEdit ? t('matchEditor.saveEdit') : t('matchEditor.saveCreate')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    hint: { color: c.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 8,
      marginBottom: 8,
    },
    versus: { fontSize: 22, fontWeight: '800', color: c.textMuted, textAlign: 'center', marginVertical: 4 },
    teamPickerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    teamPickerBtn: {
      flex: 1,
      minWidth: 100,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    teamPickerText: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },
    restingPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surfaceVariant,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 10,
    },
    restingText: { fontSize: 11, color: c.textMuted, fontWeight: '600' },

    lineupCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 10,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    lineupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    lineupTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    lineupSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    lineupBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 4 },
    lineupHint: { fontSize: 11, color: c.textMuted, marginBottom: 6 },
    lineupPlayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    lineupPlayerRowOn: { backgroundColor: c.primaryLight },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    lineupPlayerName: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    lineupPlayerNameOn: { fontWeight: '700' },
    lineupPlayerBadge: {
      fontSize: 10,
      color: c.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    expandedSection: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: -6,
      marginBottom: 10,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      gap: 12,
    },
    goalName: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    goalControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    goalBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    goalBtnDisabled: { borderColor: c.disabled, backgroundColor: c.surfaceVariant },
    goalCount: { fontSize: 15, fontWeight: '800', color: c.text, minWidth: 18, textAlign: 'center' },

    mvpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    mvpOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    mvpOptionActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    mvpOptionText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    mvpOptionTextActive: { color: c.primary, fontWeight: '700' },

    resultRow: { flexDirection: 'row', gap: 6 },
    resultBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    resultBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    resultBtnLabel: { fontSize: 12, fontWeight: '700', color: c.text },

    saveBtn: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      elevation: 6,
      shadowColor: c.primary,
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    saveBtnDisabled: { backgroundColor: c.disabled, elevation: 0, shadowOpacity: 0 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
