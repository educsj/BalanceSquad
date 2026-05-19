import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, DrawRecord, Match } from '../types';
import { getPeladaById, removeMatch } from '../storage';
import EmptyState from '../components/EmptyState';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'Matches'>;
type Nav = StackNavigationProp<RootStackParamList>;

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MatchesScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [record, setRecord] = useState<DrawRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(p => {
        if (!p) return;
        const rec = (p.drawHistory ?? [])[params.historyIndex];
        setRecord(rec ?? null);
      });
    }, [params.peladaId, params.historyIndex])
  );

  const matches = record?.matches ?? [];
  const teamById = new Map<number, string>(
    (record?.teams ?? []).map(t => [t.id, t.name]),
  );

  function describeMatch(m: Match): string {
    const home = teamById.get(m.homeTeamId) ?? `#${m.homeTeamId}`;
    const away = teamById.get(m.awayTeamId) ?? `#${m.awayTeamId}`;
    if (m.result.type === 'draw') return `${home} × ${away} · ${t('matches.draw')}`;
    const winnerName = m.result.winner === 'home' ? home : away;
    return `${home} × ${away} · ${t('matches.wonBy', { name: winnerName })}`;
  }

  function confirmDelete(matchId: string) {
    Alert.alert(t('matches.deleteTitle'), t('matches.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          await removeMatch(params.peladaId, params.historyIndex, matchId);
          getPeladaById(params.peladaId).then(p => {
            if (!p) return;
            setRecord((p.drawHistory ?? [])[params.historyIndex] ?? null);
          });
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t('matches.hint')}</Text>

      <FlatList
        data={matches}
        keyExtractor={m => m.id}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item, index }) => {
          const winner = item.result.type === 'win';
          return (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardBody}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('MatchEditor', {
                  peladaId: params.peladaId,
                  historyIndex: params.historyIndex,
                  matchId: item.id,
                })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>#{index + 1}</Text>
                  <Text style={styles.cardTime}>{formatTime(item.timestamp)}</Text>
                </View>
                <Text style={styles.cardLine} numberOfLines={2}>
                  {describeMatch(item)}
                </Text>
                <Text style={styles.cardSub}>
                  {t('matches.lineupCount', {
                    home: item.homePlayerIds.length,
                    away: item.awayPlayerIds.length,
                  })}
                </Text>
                {winner && <View style={styles.trophyBadge}><Feather name="award" size={14} color="#F59E0B" /></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="award"
            title={t('matches.emptyTitle')}
            subtitle={t('matches.emptySubtitle')}
          />
        }
      />

      <TouchableOpacity
        style={[styles.addBtn, { bottom: 24 + insets.bottom }]}
        onPress={() => navigation.navigate('MatchEditor', {
          peladaId: params.peladaId,
          historyIndex: params.historyIndex,
        })}
        activeOpacity={0.85}
      >
        <Feather name="plus-circle" size={18} color="#fff" />
        <Text style={styles.addBtnText}>{t('matches.newMatch')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    hint: { color: c.textSecondary, fontSize: 13, marginBottom: 10, fontWeight: '500' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    cardBody: { flex: 1, padding: 14, gap: 4, position: 'relative' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardIndex: { fontSize: 13, fontWeight: '800', color: c.primary },
    cardTime: { fontSize: 12, color: c.textMuted },
    cardLine: { fontSize: 14, color: c.text, fontWeight: '600' },
    cardSub: { fontSize: 12, color: c.textSecondary },
    trophyBadge: { position: 'absolute', top: 12, right: 12 },
    deleteBtn: { padding: 12, paddingRight: 16 },

    addBtn: {
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
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
