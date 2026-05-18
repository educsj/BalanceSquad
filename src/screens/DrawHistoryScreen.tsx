import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Share, Modal,
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, DrawRecord, Team } from '../types';
import { getPeladaById } from '../storage';
import EmptyState from '../components/EmptyState';
import { useTheme, ThemeColors } from '../theme';
import { formatStars, teamAverage } from '../utils/stars';
import { exportDrawToFile } from '../utils/drawShare';

type RouteProps = RouteProp<RootStackParamList, 'DrawHistory'>;
type Nav = StackNavigationProp<RootStackParamList>;

function formatTimestamp(iso: string, noDate: string, dateAt: string): string {
  if (!iso) return noDate;
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${dateAt} ${hours}:${mins}`;
}

function formatTeamsForShare(teams: Team[]): string {
  return teams.map(team => {
    const players = team.players.map(p => `  ${p.name}`).join('\n');
    return `${team.name}\n${players}`;
  }).join('\n\n');
}

// Per-entry metrics: total players, avg-of-averages, spread of averages.
// Using per-player averages keeps the metrics comparable even if teams have
// different sizes (overflow case).
function computeMetrics(teams: Team[]) {
  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);
  const teamAvgs = teams.map(t => teamAverage(t));
  const max = Math.max(...teamAvgs);
  const min = Math.min(...teamAvgs);
  const avg = teamAvgs.length === 0 ? 0 : teamAvgs.reduce((s, x) => s + x, 0) / teamAvgs.length;
  const males   = teams.flatMap(t => t.players).filter(p => p.gender === 'M').length;
  const females = teams.flatMap(t => t.players).filter(p => p.gender === 'F').length;
  return { totalPlayers, spread: max - min, avg, males, females };
}

function DrawEntry({
  record,
  index,
  peladaId,
  peladaName,
  playersPerTeam,
  navigation,
  colors,
  styles,
}: {
  record: DrawRecord;
  index: number;
  peladaId: string;
  peladaName: string;
  playersPerTeam: number;
  navigation: Nav;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const shareCardRef = useRef<View>(null);
  const { t } = useTranslation();
  const metrics = useMemo(() => computeMetrics(record.teams), [record.teams]);
  const hasGender = metrics.males + metrics.females > 0;

  async function handleShareText() {
    setShareMenuVisible(false);
    const timestamp = formatTimestamp(record.timestamp, t('drawHistory.noDate'), t('drawHistory.dateAt'));
    const text = `⚽ ${t('teams.shareCardTitle')} — BalanceSquad\n${timestamp}\n\n${formatTeamsForShare(record.teams)}`;
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
        record,
        { name: peladaName, playersPerTeam },
        t('teams.shareDataTitle'),
      );
    } catch {
      // silently ignore — the user can retry from the menu
    }
  }

  function handleResume() {
    navigation.navigate('Teams', {
      teams: record.teams,
      peladaId,
      historyIndex: index,
      balanceByGender: record.balanceByGender,
    });
  }

  function handleRebalance() {
    navigation.navigate('Teams', {
      teams: record.teams,
      peladaId,
      historyIndex: index,
      openMergeModal: true,
      balanceByGender: record.balanceByGender,
    });
  }

  return (
    <View style={styles.entry}>
      <TouchableOpacity style={styles.entryHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={styles.entryHeaderLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexBadgeText}>{index + 1}</Text>
          </View>
          <View>
            <Text style={styles.entryTimestamp}>
              {formatTimestamp(record.timestamp, t('drawHistory.noDate'), t('drawHistory.dateAt'))}
            </Text>
            <Text style={styles.entrySummary}>
              {t('drawHistory.teamsSummary', { teams: record.teams.length, players: metrics.totalPlayers })}
            </Text>
          </View>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entryBody}>
          <View style={styles.metricsRow}>
            <View style={styles.metricChip}>
              <Text style={styles.metricLabel}>{t('drawHistory.metricSpread')}</Text>
              <Text style={styles.metricValue}>{formatStars(metrics.spread)} ★</Text>
            </View>
            <View style={styles.metricChip}>
              <Text style={styles.metricLabel}>{t('drawHistory.metricAvg')}</Text>
              <Text style={styles.metricValue}>{formatStars(metrics.avg)} ★</Text>
            </View>
            {hasGender && (
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>{t('drawHistory.metricGender')}</Text>
                <Text style={styles.metricValue}>♂ {metrics.males} · ♀ {metrics.females}</Text>
              </View>
            )}
            {record.balanceByGender && (
              <View style={[styles.metricChip, styles.metricChipAccent]}>
                <Feather name="users" size={11} color={colors.primary} />
                <Text style={[styles.metricLabel, styles.metricLabelAccent]}>
                  {t('drawHistory.metricGenderBalanced')}
                </Text>
              </View>
            )}
          </View>

          {record.teams.map((team, ti) => (
            <View key={team.id} style={styles.teamSection}>
              <View style={[styles.teamHeader, { borderLeftColor: colors.teamColors[ti % colors.teamColors.length] }]}>
                <Text style={[styles.teamName, { color: colors.teamColors[ti % colors.teamColors.length] }]}>
                  {team.name}
                </Text>
                <Text style={styles.teamStars}>{formatStars(teamAverage(team))} ★ {t('teams.avgSuffix')}</Text>
              </View>
              {team.players.map(player => {
                const tint = record.balanceByGender
                  ? (player.gender === 'F' ? colors.genderTintFemale : colors.genderTintMale)
                  : undefined;
                return (
                  <View
                    key={player.id}
                    style={[styles.playerRowWrap, tint ? { backgroundColor: tint } : null]}
                  >
                    <Text style={styles.playerRow}>· {player.name}</Text>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.entryActions}>
            <TouchableOpacity style={styles.resumeBtn} onPress={handleResume} activeOpacity={0.8}>
              <Feather name="play" size={14} color="#fff" />
              <Text style={styles.resumeBtnText}>{t('drawHistory.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rebalanceBtn} onPress={handleRebalance} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.rebalanceBtnText}>{t('drawHistory.rebalance')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={() => setShareMenuVisible(true)} activeOpacity={0.8}>
              <Feather name="share-2" size={14} color={colors.primary} />
              <Text style={styles.shareBtnText}>{t('drawHistory.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Hidden share card */}
      <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
        <View style={styles.shareCardInner}>
          <Text style={styles.shareCardTitle}>{t('teams.shareCardTitle')}</Text>
          <Text style={styles.shareCardSub}>
            {formatTimestamp(record.timestamp, t('drawHistory.noDate'), t('drawHistory.dateAt'))}
          </Text>
          {record.teams.map((team, idx) => (
            <View key={team.id} style={[styles.shareTeam, { borderLeftColor: colors.teamColors[idx % colors.teamColors.length] }]}>
              <Text style={[styles.shareTeamName, { color: colors.teamColors[idx % colors.teamColors.length] }]}>
                {team.name}
              </Text>
              {team.players.map(p => (
                <Text key={p.id} style={styles.sharePlayerName}>{p.name}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>

      <Modal
        visible={shareMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareMenuVisible(false)}
      >
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
    </View>
  );
}

export default function DrawHistoryScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [history, setHistory] = useState<DrawRecord[]>([]);
  const [peladaName, setPeladaName] = useState<string>('');
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(5);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(pelada => {
        setHistory(pelada?.drawHistory ?? []);
        if (pelada) {
          setPeladaName(pelada.name);
          setPlayersPerTeam(pelada.playersPerTeam);
        }
      });
    }, [params.peladaId])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <DrawEntry
            record={item}
            index={index}
            peladaId={params.peladaId}
            peladaName={peladaName}
            playersPerTeam={playersPerTeam}
            navigation={navigation}
            colors={colors}
            styles={styles}
          />
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            icon="clock"
            title={t('drawHistory.emptyTitle')}
            subtitle={t('drawHistory.emptySubtitle')}
          />
        }
        ListHeaderComponent={
          history.length > 0 ? (
            <Text style={styles.hint}>
              {t('drawHistory.historyHint', { count: history.length })}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    hint: { color: c.textSecondary, fontSize: 13, marginBottom: 12, fontWeight: '500' },
    entry: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 6,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    entryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    indexBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    indexBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    entryTimestamp: { fontSize: 14, fontWeight: '700', color: c.text },
    entrySummary: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    entryBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },

    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    metricChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.surfaceVariant,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    metricChipAccent: { backgroundColor: c.primaryLight },
    metricLabel: { fontSize: 11, color: c.textSecondary, fontWeight: '600' },
    metricLabelAccent: { color: c.primary },
    metricValue: { fontSize: 12, color: c.text, fontWeight: '700', marginLeft: 4 },

    teamSection: { gap: 4 },
    teamHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderLeftWidth: 4,
      paddingLeft: 8,
      marginBottom: 4,
    },
    teamName: { fontSize: 14, fontWeight: '700' },
    teamStars: { fontSize: 12, color: c.textSecondary, fontWeight: '600' },
    playerRowWrap: { borderRadius: 6, marginBottom: 2 },
    playerRow: { fontSize: 13, color: c.textSecondary, paddingLeft: 12, paddingVertical: 2 },
    entryActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    resumeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 11,
    },
    resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    rebalanceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#0F766E',
      borderRadius: 8,
      padding: 11,
    },
    rebalanceBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    shareBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.background,
      borderRadius: 8,
      padding: 11,
      borderWidth: 1,
      borderColor: c.border,
    },
    shareBtnText: { color: c.primary, fontWeight: '600', fontSize: 13 },

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
  });
}
