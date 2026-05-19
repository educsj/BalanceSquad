import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, PeladaSession } from '../types';
import { getPeladaById } from '../storage';
import { useTheme, ThemeColors } from '../theme';
import EmptyState from '../components/EmptyState';

type RouteProps = RouteProp<RootStackParamList, 'SessionsCalendar'>;
type Nav = StackNavigationProp<RootStackParamList>;

// Today as YYYY-MM-DD in local time. We compare with session.date which is
// also YYYY-MM-DD, so string comparison gives us correct ordering without
// timezone surprises.
function todayLocalIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

function formatMonthHeader(monthKey: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const [year, month] = monthKey.split('-');
  return `${t(`calendar.month.${parseInt(month, 10)}`)} ${year}`;
}

function formatDayOfMonth(isoDate: string): string {
  return isoDate.slice(8, 10); // DD
}

function weekdayShort(isoDate: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const dow = d.getDay(); // 0=Sun..6=Sat
  return t(`calendar.weekday.${dow}`);
}

export default function SessionsCalendarScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<PeladaSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(params.peladaId).then(p => {
        if (p) setSessions(p.sessions ?? []);
      });
    }, [params.peladaId])
  );

  const today = todayLocalIsoDate();

  // Sort upcoming asc (closest first) then past desc (most recent first),
  // grouped by year-month for the section headers.
  const { upcoming, past } = useMemo(() => {
    const up = sessions
      .filter(s => s.date >= today && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date));
    const pa = sessions
      .filter(s => s.date < today || s.status === 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming: up, past: pa };
  }, [sessions, today]);

  function openSession(session: PeladaSession) {
    navigation.navigate('SessionDetail', { peladaId: params.peladaId, sessionId: session.id });
  }

  function openCreate() {
    navigation.navigate('SessionCreate', { peladaId: params.peladaId });
  }

  function groupByMonth(list: PeladaSession[]): { key: string; items: PeladaSession[] }[] {
    const map = new Map<string, PeladaSession[]>();
    for (const s of list) {
      const k = monthKey(s.date);
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }

  function renderSessionCard(session: PeladaSession, isPast: boolean) {
    const dayNum = formatDayOfMonth(session.date);
    const dow = weekdayShort(session.date, t);
    const isToday = session.date === today;
    const cancelled = session.status === 'cancelled';
    const completed = session.status === 'completed';
    const filled = session.rsvps.length;
    const cap = session.maxPlayers;
    const waitlistCount = session.waitlist.length;

    return (
      <TouchableOpacity
        key={session.id}
        style={[
          styles.card,
          isToday && styles.cardToday,
          (isPast || cancelled) && styles.cardPast,
        ]}
        onPress={() => openSession(session)}
        activeOpacity={0.8}
      >
        <View style={[styles.dateBlock, (isPast || cancelled) && styles.dateBlockPast]}>
          <Text style={[styles.dateDay, (isPast || cancelled) && styles.textMuted]}>{dayNum}</Text>
          <Text style={[styles.dateWeekday, (isPast || cancelled) && styles.textMuted]}>{dow}</Text>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            {session.time && (
              <Text style={[styles.cardTime, (isPast || cancelled) && styles.textMuted]}>
                {session.time}
              </Text>
            )}
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>{t('calendar.today')}</Text>
              </View>
            )}
            {cancelled && (
              <View style={styles.statusBadge}>
                <Feather name="x-circle" size={11} color={colors.danger} />
                <Text style={[styles.statusBadgeText, { color: colors.danger }]}>
                  {t('sessions.statusCancelled')}
                </Text>
              </View>
            )}
            {completed && !cancelled && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Feather name="check" size={11} color="#15803D" />
                <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>
                  {t('sessions.statusCompleted')}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.cardCapacity, (isPast || cancelled) && styles.textMuted]}>
            {t('sessions.rsvpCount', { confirmed: filled, max: cap })}
            {waitlistCount > 0 && (
              <Text style={styles.cardWaitlist}>
                {' · '}{t('sessions.waitlistCount', { count: waitlistCount })}
              </Text>
            )}
          </Text>

          {session.notes && (
            <Text style={[styles.cardNotes, (isPast || cancelled) && styles.textMuted]} numberOfLines={1}>
              {session.notes}
            </Text>
          )}
        </View>

        <Feather name="chevron-right" size={20} color={colors.border} />
      </TouchableOpacity>
    );
  }

  const isEmpty = sessions.length === 0;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="calendar"
            title={t('calendar.emptyTitle')}
            subtitle={t('calendar.emptySubtitle')}
          />
          <TouchableOpacity style={styles.emptyCta} onPress={openCreate} activeOpacity={0.8}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>{t('calendar.createFirst')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('calendar.upcomingHeader')}</Text>
              {groupByMonth(upcoming).map(group => (
                <View key={`up-${group.key}`} style={styles.monthBlock}>
                  <Text style={styles.monthHeader}>{formatMonthHeader(group.key, t)}</Text>
                  {group.items.map(s => renderSessionCard(s, false))}
                </View>
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {t('calendar.pastHeader')}
              </Text>
              {groupByMonth(past).map(group => (
                <View key={`pa-${group.key}`} style={styles.monthBlock}>
                  <Text style={styles.monthHeader}>{formatMonthHeader(group.key, t)}</Text>
                  {group.items.map(s => renderSessionCard(s, true))}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={openCreate}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    monthBlock: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    monthHeader: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginTop: 8,
      marginBottom: 2,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    cardToday: {
      borderWidth: 2,
      borderColor: c.primary,
    },
    cardPast: { opacity: 0.65 },

    dateBlock: {
      width: 52,
      paddingVertical: 6,
      backgroundColor: c.primaryLight,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateBlockPast: { backgroundColor: c.surfaceVariant },
    dateDay: { fontSize: 22, fontWeight: '800', color: c.primary, lineHeight: 24 },
    dateWeekday: { fontSize: 10, fontWeight: '700', color: c.primary, textTransform: 'uppercase' },
    textMuted: { color: c.textMuted },

    cardInfo: { flex: 1, gap: 4 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    cardTime: { fontSize: 14, fontWeight: '700', color: c.text },
    todayBadge: {
      backgroundColor: c.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    todayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(185,28,28,0.15)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },

    cardCapacity: { fontSize: 13, color: c.textSecondary },
    cardWaitlist: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
    cardNotes: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },

    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
  });
}
