import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Top-3 podium card meant to be captured into a PNG via react-native-view-shot.
// Renders off-screen with fixed dimensions so the share image is consistent
// across devices and themes (always the light palette for legibility).

export interface PodiumEntry {
  name: string;
  primary: string;     // big value, e.g. "5" or "67%"
  secondary?: string;  // small unit/context, e.g. "vitórias"
}

interface Props {
  title: string;
  subtitle: string;
  entries: PodiumEntry[];          // up to 3; ordered #1, #2, #3
  appName?: string;
  footer?: string;
}

const PRIMARY = '#1E3A5F';
const ACCENT = '#F59E0B';
const SILVER = '#94A3B8';
const BRONZE = '#B45309';

const POSITION_COLORS = [ACCENT, SILVER, BRONZE];

export default function PodiumCard({ title, subtitle, entries, appName, footer }: Props) {
  const top3 = entries.slice(0, 3);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="award" size={26} color={ACCENT} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {top3.map((entry, i) => {
        const isTop = i === 0;
        return (
          <View key={i} style={[styles.podiumRow, isTop && styles.podiumRowTop]}>
            <View style={[styles.posBadge, { backgroundColor: POSITION_COLORS[i] }]}>
              {isTop
                ? <Feather name="award" size={18} color="#fff" />
                : <Text style={styles.posBadgeText}>{i + 1}</Text>}
            </View>
            <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
            <View style={styles.entryValueGroup}>
              <Text style={styles.entryPrimary}>{entry.primary}</Text>
              {entry.secondary && (
                <Text style={styles.entrySecondary}>{entry.secondary}</Text>
              )}
            </View>
          </View>
        );
      })}

      {footer && <Text style={styles.footer}>{footer}</Text>}
      <Text style={styles.app}>{appName ?? 'BalanceSquad'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#F0F4FF',
    padding: 22,
    borderRadius: 16,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: PRIMARY, lineHeight: 24 },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  podiumRowTop: {
    borderWidth: 2,
    borderColor: ACCENT,
  },
  posBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBadgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  entryName: { flex: 1, fontSize: 15, fontWeight: '700', color: PRIMARY },
  entryValueGroup: { alignItems: 'flex-end' },
  entryPrimary: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  entrySecondary: { fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
  footer: { fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 4 },
  app: { fontSize: 11, color: '#94A3B8', textAlign: 'center', fontWeight: '700' },
});
