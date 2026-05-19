import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, Pelada, DrawRecord } from '../types';
import { getPeladaById } from '../storage';
import EmptyState from '../components/EmptyState';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'Ranking'>;

interface Stat {
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number; // 0..1
}

// Aggregates wins/draws/losses across every match in every draw of the pelada.
// A player is counted on the side(s) they were actually listed for in that
// match — so swaps between teams are reflected accurately, unlike the old
// per-sorteio result model.
function aggregateStats(pelada: Pelada): Stat[] {
  const nameById = new Map<string, string>();
  pelada.players.forEach(p => nameById.set(p.id, p.name));

  const counters = new Map<string, { played: number; wins: number; draws: number; losses: number }>();
  const ensure = (id: string, name: string) => {
    if (!nameById.has(id)) nameById.set(id, name);
    if (!counters.has(id)) counters.set(id, { played: 0, wins: 0, draws: 0, losses: 0 });
    return counters.get(id)!;
  };

  const history = pelada.drawHistory ?? [];
  for (const record of history) {
    // Snapshot player names from this record so deleted/renamed players still
    // appear in the ranking with the name they had at the time.
    record.teams.forEach(t => t.players.forEach(p => {
      if (!nameById.has(p.id)) nameById.set(p.id, p.name);
    }));

    const matches = record.matches ?? [];
    for (const m of matches) {
      const homeWon = m.result.type === 'win' && m.result.winner === 'home';
      const awayWon = m.result.type === 'win' && m.result.winner === 'away';
      m.homePlayerIds.forEach(id => {
        const stat = ensure(id, nameById.get(id) ?? '—');
        stat.played += 1;
        if (m.result.type === 'draw') stat.draws += 1;
        else if (homeWon) stat.wins += 1;
        else stat.losses += 1;
      });
      m.awayPlayerIds.forEach(id => {
        const stat = ensure(id, nameById.get(id) ?? '—');
        stat.played += 1;
        if (m.result.type === 'draw') stat.draws += 1;
        else if (awayWon) stat.wins += 1;
        else stat.losses += 1;
      });
    }
  }

  const rows: Stat[] = [];
  counters.forEach((c, id) => {
    rows.push({
      id,
      name: nameById.get(id) ?? '—',
      played: c.played,
      wins: c.wins,
      draws: c.draws,
      losses: c.losses,
      winRate: c.played === 0 ? 0 : c.wins / c.played,
    });
  });

  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.played - a.played;
  });
  return rows;
}

function totalMatchesCount(history: DrawRecord[]): number {
  return history.reduce((s, r) => s + (r.matches?.length ?? 0), 0);
}

export default function RankingScreen() {
  const { params } = useRoute<RouteProps>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [stats, setStats] = useState<Stat[]>([]);
  const [draws, setDraws] = useState(0);
  const [minMatchesFilter, setMinMatchesFilter] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(pelada => {
        if (!pelada) return;
        setStats(aggregateStats(pelada));
        setDraws(totalMatchesCount(pelada.drawHistory ?? []));
      });
    }, [params.peladaId])
  );

  const MIN_MATCHES = 3;
  const visibleStats = minMatchesFilter
    ? stats.filter(s => s.played >= MIN_MATCHES)
    : stats;

  if (stats.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="award"
          title={t('ranking.emptyTitle')}
          subtitle={t('ranking.emptySubtitle')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hintRow}>
        <Text style={styles.hint}>{t('ranking.hint', { count: draws })}</Text>
        <TouchableOpacity
          style={[styles.minChip, minMatchesFilter && styles.minChipOn]}
          onPress={() => setMinMatchesFilter(v => !v)}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={11} color={minMatchesFilter ? colors.primary : colors.textMuted} />
          <Text style={[styles.minChipText, minMatchesFilter && styles.minChipTextOn]}>
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
        data={visibleStats}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item, index }) => {
          const isTop = index === 0 && item.wins > 0;
          return (
            <View style={[styles.row, isTop && styles.rowTop]}>
              <View style={styles.rankCellView}>
                {isTop
                  ? <Feather name="award" size={14} color="#F59E0B" />
                  : <Text style={styles.rankText}>{index + 1}</Text>
                }
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
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    hint: { flex: 1, color: c.textSecondary, fontSize: 13, fontWeight: '500' },
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
      paddingVertical: 8,
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
    nameText: { fontWeight: '600' },
    numColText: { width: 36, textAlign: 'center' },
    winsText: { fontWeight: '700', color: '#16A34A' },
    rateColText: { width: 44, textAlign: 'right', paddingRight: 4 },
    rateText: { fontWeight: '700', color: c.primary },
  });
}
