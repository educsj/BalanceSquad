import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Share,
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, DrawRecord, Team } from '../types';
import { getPeladaById } from '../storage';

type RouteProps = RouteProp<RootStackParamList, 'DrawHistory'>;
type Nav = StackNavigationProp<RootStackParamList>;

const TEAM_COLORS = ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'];

function formatTimestamp(iso: string): string {
  if (!iso) return 'Sem data registrada';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${mins}`;
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

  async function handleShare() {
    const text = `⚽ Times — BalanceSquad\n${formatTimestamp(record.timestamp)}\n\n${formatTeamsForShare(record.teams)}`;
    await Share.share({ message: text });
  }

  function handleMerge() {
    navigation.navigate('Teams', { teams: record.teams, peladaId, historyIndex: index });
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
            <Text style={styles.entryTimestamp}>{formatTimestamp(record.timestamp)}</Text>
            <Text style={styles.entrySummary}>
              {record.teams.length} times · {totalPlayers} jogadores
            </Text>
          </View>
        </View>
        <Text style={styles.expandArrow}>{expanded ? '▲' : '▼'}</Text>
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
            <TouchableOpacity style={styles.mergeBtn} onPress={handleMerge} activeOpacity={0.8}>
              <Text style={styles.mergeBtnText}>🔀  Mesclar Times</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Text style={styles.shareBtnText}>📤  Compartilhar</Text>
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
          <Text style={styles.empty}>Nenhum sorteio registrado ainda.</Text>
        }
        ListHeaderComponent={
          history.length > 0 ? (
            <Text style={styles.hint}>Os últimos {history.length} sorteios estão registrados abaixo.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF', padding: 16 },
  hint: { color: '#64748B', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 60, fontSize: 14 },

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
  expandArrow: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },

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
  mergeBtn: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
  },
  mergeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  shareBtn: {
    flex: 1,
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shareBtnText: { color: '#1E3A5F', fontWeight: '600', fontSize: 13 },
});
