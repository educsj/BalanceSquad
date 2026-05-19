import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, Pelada } from '../types';
import { getPeladaById } from '../storage';
import { buildPlayerProfile, PlayerProfile, aggregateAttendance } from '../utils/rankings';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'PlayerProfile'>;

export default function PlayerProfileScreen() {
  const { params } = useRoute<RouteProps>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pelada, setPelada] = useState<Pelada | null>(null);
  const shareCardRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(p => setPelada(p ?? null));
    }, [params.peladaId])
  );

  const profile: PlayerProfile | null = useMemo(
    () => pelada ? buildPlayerProfile(pelada, params.playerId, null) : null,
    [pelada, params.playerId],
  );

  // Attendance (% de sessões/game days que o jogador apareceu, all-time).
  const attendance = useMemo(() => {
    if (!pelada) return null;
    return aggregateAttendance(pelada, null).find(a => a.id === params.playerId) ?? null;
  }, [pelada, params.playerId]);

  async function handleShare() {
    if (!profile) return;
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: profile.name });
      }
    } catch {
      // silent
    }
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{t('profile.empty')}</Text>
      </View>
    );
  }

  const winRate = profile.played === 0 ? 0 : profile.wins / profile.played;
  const topH2H = profile.headToHead.filter(h => h.played > 0).slice(0, 5);
  const topTeammates = profile.teammates.filter(t => t.played > 0).slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.headerCard}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.peladaName}>{pelada?.name}</Text>
        </View>

        <View style={styles.statRow}>
          <StatTile label={t('profile.played')} value={String(profile.played)} colors={colors} />
          <StatTile label={t('profile.wins')} value={String(profile.wins)} highlight colors={colors} />
          <StatTile label={t('profile.draws')} value={String(profile.draws)} colors={colors} />
          <StatTile label={t('profile.losses')} value={String(profile.losses)} colors={colors} />
        </View>
        <View style={styles.statRow}>
          <StatTile label={t('profile.winRate')} value={`${Math.round(winRate * 100)}%`} colors={colors} accent />
          <StatTile label={t('profile.goals')} value={String(profile.goals)} colors={colors} accent />
          <StatTile label={t('profile.mvps')} value={String(profile.mvps)} colors={colors} accent />
        </View>

        {attendance && attendance.total > 0 && (
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceIconCircle}>
              <Feather name="user-check" size={18} color="#15803D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attendanceLabel}>{t('profile.attendance')}</Text>
              <Text style={styles.attendanceSubtitle}>
                {t('profile.attendanceDetail', {
                  attended: attendance.attended,
                  total: attendance.total,
                })}
              </Text>
            </View>
            <Text style={styles.attendancePct}>
              {Math.round(attendance.percentage * 100)}%
            </Text>
          </View>
        )}

        {topH2H.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.h2hTitle')}</Text>
            <Text style={styles.sectionHint}>{t('profile.h2hHint')}</Text>
            {topH2H.map(h => (
              <View key={h.id} style={styles.h2hRow}>
                <Text style={styles.h2hName} numberOfLines={1}>{h.name}</Text>
                <View style={styles.h2hStats}>
                  <Text style={[styles.h2hStat, styles.h2hWin]}>{h.wins}V</Text>
                  <Text style={styles.h2hStat}>{h.draws}E</Text>
                  <Text style={[styles.h2hStat, styles.h2hLoss]}>{h.losses}D</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {topTeammates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.teammateTitle')}</Text>
            <Text style={styles.sectionHint}>{t('profile.teammateHint')}</Text>
            {topTeammates.map(tm => {
              const rate = tm.played === 0 ? 0 : tm.wins / tm.played;
              return (
                <View key={tm.id} style={styles.h2hRow}>
                  <Text style={styles.h2hName} numberOfLines={1}>{tm.name}</Text>
                  <View style={styles.h2hStats}>
                    <Text style={styles.h2hStat}>{tm.played}J</Text>
                    <Text style={[styles.h2hStat, styles.h2hWin]}>{tm.wins}V</Text>
                    <Text style={[styles.h2hStat, styles.h2hRate]}>{Math.round(rate * 100)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Feather name="share-2" size={16} color="#fff" />
          <Text style={styles.shareBtnText}>{t('profile.share')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Hidden card */}
      <View ref={shareCardRef} style={styles.hiddenCard} collapsable={false}>
        <View style={styles.shareCard}>
          <View style={styles.shareHeader}>
            <Feather name="user" size={26} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.shareName}>{profile.name}</Text>
              <Text style={styles.sharePelada}>{pelada?.name ?? ''}</Text>
            </View>
          </View>

          <View style={styles.shareGrid}>
            <ShareTile label={t('profile.played')} value={String(profile.played)} />
            <ShareTile label={t('profile.wins')} value={String(profile.wins)} />
            <ShareTile label={t('profile.winRate')} value={`${Math.round(winRate * 100)}%`} accent />
          </View>
          <View style={styles.shareGrid}>
            <ShareTile label={t('profile.goals')} value={String(profile.goals)} />
            <ShareTile label={t('profile.mvps')} value={String(profile.mvps)} />
            <ShareTile label={t('profile.draws')} value={String(profile.draws)} />
          </View>

          <Text style={styles.shareApp}>BalanceSquad</Text>
        </View>
      </View>
    </View>
  );
}

function StatTile({ label, value, highlight, accent, colors }: {
  label: string; value: string; highlight?: boolean; accent?: boolean; colors: ThemeColors;
}) {
  return (
    <View style={[
      tileStyles.tile,
      { backgroundColor: colors.surface, borderColor: colors.borderLight },
      highlight && { borderColor: '#16A34A' },
      accent && { borderColor: colors.primary },
    ]}>
      <Text style={[
        tileStyles.value,
        { color: colors.text },
        highlight && { color: '#16A34A' },
        accent && { color: colors.primary },
      ]}>{value}</Text>
      <Text style={[tileStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ShareTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={shareTileStyles.tile}>
      <Text style={[shareTileStyles.value, accent && { color: '#F59E0B' }]}>{value}</Text>
      <Text style={shareTileStyles.label}>{label}</Text>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
});

const shareTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  value: { fontSize: 22, fontWeight: '800', color: '#1E3A5F' },
  label: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginTop: 2 },
});

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    empty: { color: c.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 50 },
    headerCard: {
      backgroundColor: c.primary,
      borderRadius: 14,
      padding: 18,
      marginBottom: 14,
    },
    name: { color: '#fff', fontSize: 22, fontWeight: '800' },
    peladaName: { color: c.headerSub, fontSize: 13, fontWeight: '600', marginTop: 4 },

    statRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },

    attendanceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginVertical: 6,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    attendanceIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(34,197,94,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    attendanceLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    attendanceSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    attendancePct: { fontSize: 22, fontWeight: '800', color: '#15803D' },

    section: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: 6,
      marginBottom: 6,
      gap: 8,
    },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text },
    sectionHint: { fontSize: 11, color: c.textMuted },
    h2hRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      paddingTop: 8,
    },
    h2hName: { flex: 1, fontSize: 13, color: c.text, fontWeight: '600' },
    h2hStats: { flexDirection: 'row', gap: 10 },
    h2hStat: { fontSize: 13, fontWeight: '700', color: c.textSecondary, minWidth: 28, textAlign: 'right' },
    h2hWin: { color: '#16A34A' },
    h2hLoss: { color: c.danger },
    h2hRate: { color: c.primary },

    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 13,
      marginTop: 16,
      elevation: 4,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    hiddenCard: { position: 'absolute', left: -9999, top: 0 },
    shareCard: {
      width: 360,
      backgroundColor: '#F0F4FF',
      padding: 22,
      borderRadius: 16,
      gap: 10,
    },
    shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    shareName: { fontSize: 20, fontWeight: '800', color: '#1E3A5F' },
    sharePelada: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
    shareGrid: { flexDirection: 'row', gap: 8 },
    shareApp: { fontSize: 11, color: '#94A3B8', textAlign: 'center', fontWeight: '700', marginTop: 4 },
  });
}
