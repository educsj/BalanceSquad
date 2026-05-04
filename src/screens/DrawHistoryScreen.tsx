import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Share,
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, DrawRecord, Team } from '../types';
import { getPeladaById } from '../storage';
import EmptyState from '../components/EmptyState';

type RouteProps = RouteProp<RootStackParamList, 'DrawHistory'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_COLORS = ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'];

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

function DrawEntry({
  record,
  index,
  peladaId,
  navigation,
}: {
  record: DrawRecord;
  index: number;
  peladaId: string;
  navigation: Nav;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const { t } = useTranslation();

  async function handleShare() {
    const timestamp = formatTimestamp(record.timestamp, t('drawHistory.noDate'), t('drawHistory.dateAt'));
    const text = `⚽ ${t('teams.shareCardTitle')} — BalanceSquad\n${timestamp}\n\n${formatTeamsForShare(record.teams)}`;
    await Share.share({ message: text });
  }

  function handleAdjust() {
    navigation.navigate('Teams', { teams: record.teams, peladaId, historyIndex: index });
  }

  function handleRebalance() {
    navigation.navigate('Teams', { teams: record.teams, peladaId, historyIndex: index, openMergeModal: true });
  }

  const totalPlayers = record.teams.reduce((s, t) => s + t.players.length, 0);

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
              {t('drawHistory.teamsSummary', { teams: record.teams.length, players: totalPlayers })}
            </Text>
          </View>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entryBody}>
          {record.teams.map((team, ti) => (
            <View key={team.id} style={styles.teamSection}>
              <View style={[styles.teamHeader, { borderLeftColor: TEAM_COLORS[ti % TEAM_COLORS.length] }]}>
                <Text style={[styles.teamName, { color: TEAM_COLORS[ti % TEAM_COLORS.length] }]}>
                  {team.name}
                </Text>
                <Text style={styles.teamStars}>{team.totalStars} ★</Text>
              </View>
              {team.players.map(player => (
                <Text key={player.id} style={styles.playerRow}>· {player.name}</Text>
              ))}
            </View>
          ))}

          <View style={styles.entryActions}>
            <TouchableOpacity style={styles.adjustBtn} onPress={handleAdjust} activeOpacity={0.8}>
              <Feather name="edit-2" size={14} color="#fff" />
              <Text style={styles.adjustBtnText}>{t('drawHistory.adjust')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rebalanceBtn} onPress={handleRebalance} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.rebalanceBtnText}>{t('drawHistory.rebalance')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Feather name="send" size={14} color="#1E3A5F" />
              <Text style={styles.shareBtnText}>{t('drawHistory.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function DrawHistoryScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const [history, setHistory] = useState<DrawRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(pelada => {
        setHistory(pelada?.drawHistory ?? []);
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
            navigation={navigation}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },
  hint: { color: '#64748B', fontSize: 13, marginBottom: 12, fontWeight: '500' },

  entry: {
    backgroundColor: '#fff',
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
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  entryTimestamp: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
  entrySummary: { fontSize: 12, color: '#64748B', marginTop: 2 },

  entryBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
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
  teamStars: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  playerRow: { fontSize: 13, color: '#475569', paddingLeft: 12 },

  entryActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  adjustBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 11,
  },
  adjustBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shareBtnText: { color: '#1E3A5F', fontWeight: '600', fontSize: 13 },
});
