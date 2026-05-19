import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, Pelada } from '../types';
import { getPeladaById } from '../storage';
import EmptyState from '../components/EmptyState';
import PodiumCard, { PodiumEntry } from '../components/PodiumCard';
import { useTheme, ThemeColors } from '../theme';
import { PeriodKind, computePeriodRange, PeriodRange, addDays, addMonths } from '../utils/periods';
import {
  aggregatePlayerStats,
  aggregateScorers,
  aggregateMvps,
  aggregateTeamChampions,
  periodMatchCount,
  PlayerStat,
  ScorerStat,
  MvpStat,
  TeamChampionEntry,
} from '../utils/rankings';

type RouteProps = RouteProp<RootStackParamList, 'Ranking'>;

const PERIODS: PeriodKind[] = ['week', 'month', 'quarter', 'semester', 'year', 'all'];
type Tab = 'wins' | 'scorers' | 'mvps' | 'teams';
const TABS: Tab[] = ['wins', 'scorers', 'mvps', 'teams'];

const MIN_MATCHES = 3;

export default function RankingScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const openProfile = useCallback((playerId: string) => {
    navigation.navigate('PlayerProfile', { peladaId: params.peladaId, playerId });
  }, [navigation, params.peladaId]);

  const [pelada, setPelada] = useState<Pelada | null>(null);
  const [period, setPeriod] = useState<PeriodKind>('all');
  // Reference date for the current period window. Defaults to "now"; updated by
  // the prev/next arrows. Reset to a fresh `new Date()` whenever the user
  // switches the period kind (week → month, etc) so "Month" always starts on
  // the current month.
  const [periodRef, setPeriodRef] = useState<Date>(() => new Date());
  const [tab, setTab] = useState<Tab>('wins');
  const [minFilter, setMinFilter] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(p => setPelada(p ?? null));
    }, [params.peladaId])
  );

  function selectPeriod(p: PeriodKind) {
    setPeriod(p);
    setPeriodRef(new Date());
  }

  function shiftPeriod(direction: -1 | 1) {
    if (period === 'all') return;
    setPeriodRef(prev => {
      if (period === 'week') return addDays(prev, 7 * direction);
      if (period === 'month') return addMonths(prev, 1 * direction);
      if (period === 'quarter') return addMonths(prev, 3 * direction);
      if (period === 'semester') return addMonths(prev, 6 * direction);
      if (period === 'year') return addMonths(prev, 12 * direction);
      return prev;
    });
  }

  const range: PeriodRange | null = useMemo(
    () => computePeriodRange(period, periodRef),
    [period, periodRef],
  );

  const players = useMemo(() => pelada ? aggregatePlayerStats(pelada, range) : [], [pelada, range]);
  const scorers = useMemo(() => pelada ? aggregateScorers(pelada, range) : [], [pelada, range]);
  const mvps = useMemo(() => pelada ? aggregateMvps(pelada, range) : [], [pelada, range]);
  const teamsRanking = useMemo(() => pelada ? aggregateTeamChampions(pelada, range) : [], [pelada, range]);
  const totalMatches = useMemo(() => pelada ? periodMatchCount(pelada, range) : 0, [pelada, range]);

  const visiblePlayers = minFilter ? players.filter(p => p.played >= MIN_MATCHES) : players;

  const shareCardRef = useRef<View>(null);

  // Builds the podium content for the current active tab. Memoized so the
  // hidden card re-renders only when the underlying data shifts.
  const cardData = useMemo((): { title: string; subtitle: string; entries: PodiumEntry[]; footer?: string } | null => {
    const periodLabel = range?.label ?? t('ranking.period.all');
    const ctx = `${pelada?.name ?? ''} · ${periodLabel}`;
    if (tab === 'wins') {
      const eligible = minFilter ? visiblePlayers : players;
      const top = eligible.slice(0, 3);
      if (top.length === 0) return null;
      return {
        title: t('ranking.cardTitle.wins'),
        subtitle: ctx,
        entries: top.map(p => ({
          name: p.name,
          primary: `${Math.round(p.winRate * 100)}%`,
          secondary: t('ranking.cardUnit.winsCount', { count: p.wins }),
        })),
      };
    }
    if (tab === 'scorers') {
      const top = scorers.slice(0, 3);
      if (top.length === 0) return null;
      return {
        title: t('ranking.cardTitle.scorers'),
        subtitle: ctx,
        entries: top.map(s => ({
          name: s.name,
          primary: String(s.goals),
          secondary: t('ranking.goalsUnit'),
        })),
      };
    }
    if (tab === 'mvps') {
      const top = mvps.slice(0, 3);
      if (top.length === 0) return null;
      return {
        title: t('ranking.cardTitle.mvps'),
        subtitle: ctx,
        entries: top.map(m => ({
          name: m.name,
          primary: String(m.count),
          secondary: t('ranking.cardUnit.mvpTimes', { count: m.count }),
        })),
      };
    }
    if (tab === 'teams') {
      const top = teamsRanking.slice(0, 3);
      if (top.length === 0) return null;
      return {
        title: t('ranking.cardTitle.teams'),
        subtitle: ctx,
        entries: top.map(c => ({
          name: c.teamName,
          primary: `${c.wins}/${c.totalMatches}`,
          secondary: c.recordTimestamp ? new Date(c.recordTimestamp).toLocaleDateString() : '',
        })),
      };
    }
    return null;
  }, [tab, range, players, visiblePlayers, scorers, mvps, teamsRanking, pelada, minFilter, t]);

  async function handleShareCard() {
    if (!cardData) return;
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: cardData.title });
      }
    } catch {
      // silent — user can retry
    }
  }

  if (!pelada) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodBar}>
        {PERIODS.map(p => {
          const active = period === p;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => selectPeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                {t(`ranking.period.${p}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {range ? (
        <View style={styles.rangeNavRow}>
          <TouchableOpacity
            style={styles.rangeNavBtn}
            onPress={() => shiftPeriod(-1)}
            accessibilityLabel={t('ranking.periodPrev')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.rangeLabel}>{range.label}</Text>
          <TouchableOpacity
            style={styles.rangeNavBtn}
            onPress={() => shiftPeriod(1)}
            accessibilityLabel={t('ranking.periodNext')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={styles.matchesCount}>
        {t('ranking.matchesInPeriod', { count: totalMatches })}
      </Text>

      <View style={styles.tabBar}>
        {TABS.map(tk => {
          const active = tab === tk;
          return (
            <TouchableOpacity
              key={tk}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(tk)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(`ranking.tab.${tk}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'wins' && (
        <WinsTab
          stats={visiblePlayers}
          allCount={players.length}
          minFilter={minFilter}
          onToggleFilter={() => setMinFilter(v => !v)}
          onOpenProfile={openProfile}
          styles={styles}
          colors={colors}
          t={t}
        />
      )}
      {tab === 'scorers' && (
        <ScorersTab stats={scorers} onOpenProfile={openProfile} styles={styles} t={t} />
      )}
      {tab === 'mvps' && (
        <MvpsTab stats={mvps} onOpenProfile={openProfile} styles={styles} t={t} />
      )}
      {tab === 'teams' && (
        <TeamsTab champions={teamsRanking} styles={styles} t={t} />
      )}

      {cardData && (
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareCard} activeOpacity={0.85}>
          <Feather name="share-2" size={16} color="#fff" />
          <Text style={styles.shareBtnText}>{t('ranking.shareTop3')}</Text>
        </TouchableOpacity>
      )}

      {/* Hidden capture card for the share image */}
      {cardData && (
        <View ref={shareCardRef} style={styles.hiddenCard} collapsable={false}>
          <PodiumCard
            title={cardData.title}
            subtitle={cardData.subtitle}
            entries={cardData.entries}
          />
        </View>
      )}
    </View>
  );
}

// ───────── Tabs ──────────────────────────────────────────────────────────────

function WinsTab({
  stats, allCount, minFilter, onToggleFilter, onOpenProfile, styles, colors, t,
}: {
  stats: PlayerStat[];
  allCount: number;
  minFilter: boolean;
  onToggleFilter: () => void;
  onOpenProfile: (playerId: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (allCount === 0) {
    return <EmptyState icon="award" title={t('ranking.emptyTitle')} subtitle={t('ranking.emptySubtitle')} />;
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.minChip, minFilter && styles.minChipOn]}
          onPress={onToggleFilter}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={11} color={minFilter ? colors.primary : colors.textMuted} />
          <Text style={[styles.minChipText, minFilter && styles.minChipTextOn]}>
            {t('ranking.minMatches', { count: MIN_MATCHES })}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.rankColText]}>#</Text>
        <Text style={[styles.headerCell, styles.nameColText]}>{t('ranking.player')}</Text>
        <Text style={[styles.headerCell, styles.numColText]}>{t('ranking.played')}</Text>
        <Text style={[styles.headerCell, styles.numColText]}>{t('ranking.wins')}</Text>
        <Text style={[styles.headerCell, styles.numColText]}>{t('ranking.draws')}</Text>
        <Text style={[styles.headerCell, styles.numColText]}>{t('ranking.losses')}</Text>
        <Text style={[styles.headerCell, styles.rateColText]}>%</Text>
      </View>
      <FlatList
        data={stats}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyTabHint}>{t('ranking.emptyAfterFilter')}</Text>
        }
        renderItem={({ item, index }) => {
          const isTop = index === 0 && item.wins > 0;
          return (
            <TouchableOpacity
              style={[styles.row, isTop && styles.rowTop]}
              onPress={() => onOpenProfile(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.rankCellView}>
                {isTop
                  ? <Feather name="award" size={14} color="#F59E0B" />
                  : <Text style={styles.rankText}>{index + 1}</Text>}
              </View>
              <Text style={[styles.cellText, styles.nameColText, styles.nameText]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.cellText, styles.numColText]}>{item.played}</Text>
              <Text style={[styles.cellText, styles.numColText, styles.winsText]}>{item.wins}</Text>
              <Text style={[styles.cellText, styles.numColText]}>{item.draws}</Text>
              <Text style={[styles.cellText, styles.numColText]}>{item.losses}</Text>
              <Text style={[styles.cellText, styles.rateColText, styles.rateText]}>
                {Math.round(item.winRate * 100)}%
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function ScorersTab({ stats, onOpenProfile, styles, t }: {
  stats: ScorerStat[];
  onOpenProfile: (playerId: string) => void;
  styles: ReturnType<typeof createStyles>;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (stats.length === 0) {
    return <EmptyState icon="target" title={t('ranking.scorers.emptyTitle')} subtitle={t('ranking.scorers.emptySubtitle')} />;
  }
  return (
    <FlatList
      data={stats}
      keyExtractor={s => s.id}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item, index }) => {
        const isTop = index === 0;
        return (
          <TouchableOpacity
            style={[styles.row, isTop && styles.rowTop]}
            onPress={() => onOpenProfile(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.rankCellView}>
              {isTop
                ? <Feather name="award" size={14} color="#F59E0B" />
                : <Text style={styles.rankText}>{index + 1}</Text>}
            </View>
            <Text style={[styles.cellText, styles.nameColTextWide, styles.nameText]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metricStack}>
              <Text style={styles.goalsBigText}>{item.goals}</Text>
              <Text style={styles.metricUnit}>{t('ranking.goalsUnit')}</Text>
            </View>
            <View style={styles.metricStack}>
              <Text style={styles.cellText}>{item.matches}</Text>
              <Text style={styles.metricUnit}>{t('ranking.matchesUnit')}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function MvpsTab({ stats, onOpenProfile, styles, t }: {
  stats: MvpStat[];
  onOpenProfile: (playerId: string) => void;
  styles: ReturnType<typeof createStyles>;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (stats.length === 0) {
    return <EmptyState icon="star" title={t('ranking.mvps.emptyTitle')} subtitle={t('ranking.mvps.emptySubtitle')} />;
  }
  return (
    <FlatList
      data={stats}
      keyExtractor={s => s.id}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item, index }) => {
        const isTop = index === 0;
        return (
          <TouchableOpacity
            style={[styles.row, isTop && styles.rowTop]}
            onPress={() => onOpenProfile(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.rankCellView}>
              {isTop
                ? <Feather name="star" size={14} color="#F59E0B" />
                : <Text style={styles.rankText}>{index + 1}</Text>}
            </View>
            <Text style={[styles.cellText, styles.nameColTextWide, styles.nameText]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.cellText, styles.goalsBigText]}>{item.count}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function TeamsTab({ champions, styles, t }: {
  champions: TeamChampionEntry[];
  styles: ReturnType<typeof createStyles>;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (champions.length === 0) {
    return <EmptyState icon="shield" title={t('ranking.teams.emptyTitle')} subtitle={t('ranking.teams.emptySubtitle')} />;
  }
  return (
    <FlatList
      data={champions}
      keyExtractor={(c, i) => `${c.recordIndex}-${i}`}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item, index }) => {
        const date = item.recordTimestamp
          ? new Date(item.recordTimestamp).toLocaleDateString()
          : t('ranking.teams.noDate');
        const isTop = index === 0;
        return (
          <View style={[styles.row, isTop && styles.rowTop, { alignItems: 'flex-start' }]}>
            <View style={styles.rankCellView}>
              {isTop
                ? <Feather name="award" size={14} color="#F59E0B" />
                : <Text style={styles.rankText}>{index + 1}</Text>}
            </View>
            <View style={styles.teamChampInfo}>
              <Text style={styles.teamChampName} numberOfLines={1}>{item.teamName}</Text>
              <Text style={styles.teamChampDate}>{date}</Text>
            </View>
            <View style={styles.metricStack}>
              <Text style={styles.goalsBigText}>{item.wins}</Text>
              <Text style={styles.metricUnit}>
                {t('ranking.teams.winsOfTotal', { total: item.totalMatches })}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

// ───────── Styles ────────────────────────────────────────────────────────────

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 16, paddingTop: 12 },
    periodBar: { flexDirection: 'row', gap: 6, paddingRight: 16 },
    periodChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    periodChipActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    periodChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
    periodChipTextActive: { color: c.primary },
    rangeNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 10,
    },
    rangeNavBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangeLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '700' },
    matchesCount: { fontSize: 11, color: c.textMuted, marginTop: 2, marginBottom: 10, textAlign: 'center' },

    tabBar: {
      flexDirection: 'row',
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
      padding: 3,
      marginBottom: 10,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: c.surface, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2 },
    tabText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
    tabTextActive: { color: c.primary },

    filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, justifyContent: 'flex-end' },
    minChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.surfaceVariant,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.borderLight,
    },
    minChipOn: { borderColor: c.primary, backgroundColor: c.primaryLight },
    minChipText: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase' },
    minChipTextOn: { color: c.primary },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    headerCell: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 4,
      marginTop: 6,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 3,
    },
    rowTop: { borderWidth: 2, borderColor: '#F59E0B' },
    cellText: { fontSize: 13, color: c.text },
    rankCellView: { width: 32, alignItems: 'center', justifyContent: 'center' },
    rankColText: { width: 32, textAlign: 'center' },
    rankText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    nameColText: { flex: 1, paddingHorizontal: 4 },
    nameColTextWide: { flex: 2, paddingHorizontal: 8 },
    nameText: { fontWeight: '600' },
    numColText: { width: 32, textAlign: 'center' },
    winsText: { fontWeight: '700', color: '#16A34A' },
    rateColText: { width: 44, textAlign: 'right', paddingRight: 4 },
    rateText: { fontWeight: '700', color: c.primary },

    metricStack: { alignItems: 'center', minWidth: 60, paddingHorizontal: 4 },
    goalsBigText: { fontSize: 18, fontWeight: '800', color: c.primary },
    metricUnit: { fontSize: 9, color: c.textMuted, textTransform: 'uppercase', fontWeight: '700' },

    teamChampInfo: { flex: 1, paddingHorizontal: 4 },
    teamChampName: { fontSize: 14, fontWeight: '700', color: c.text },
    teamChampDate: { fontSize: 11, color: c.textMuted, marginTop: 2 },

    emptyTabHint: { color: c.textMuted, textAlign: 'center', marginTop: 30, fontSize: 13 },

    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 10,
      marginBottom: 16,
      elevation: 4,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    hiddenCard: { position: 'absolute', left: -9999, top: 0 },
  });
}
