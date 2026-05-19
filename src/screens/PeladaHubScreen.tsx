import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { getPeladaById } from '../storage';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'PeladaHub'>;
type Nav = StackNavigationProp<RootStackParamList>;

function formatShortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

type Action = {
  featherIcon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export default function PeladaHubScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [playerCount, setPlayerCount] = useState(0);
  const [drawCount, setDrawCount] = useState(0);
  const [lastDrawDate, setLastDrawDate] = useState('');
  const [rankedDraws, setRankedDraws] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        navigation.setOptions({ title: pelada.name });
        setPlayerCount(pelada.players.length);
        const history = pelada.drawHistory ?? [];
        setDrawCount(history.length);
        setLastDrawDate(history[0]?.timestamp ?? '');
        setRankedDraws(history.reduce((s, r) => s + (r.matches?.length ?? 0), 0));
      });
    }, [peladaId])
  );

  const actions: Action[] = [
    {
      featherIcon: 'user-plus',
      iconBg: colors.primaryLight,
      iconColor: colors.primary,
      title: t('peladaHub.registerPlayer'),
      subtitle: t('peladaHub.playersCount', { count: playerCount }),
      onPress: () => navigation.navigate('PlayerRegister', { peladaId }),
    },
    {
      featherIcon: 'users',
      iconBg: '#DBEAFE',
      iconColor: '#2563EB',
      title: t('peladaHub.playerList'),
      subtitle: playerCount > 0
        ? t('peladaHub.playerListDesc')
        : t('peladaHub.playerListEmpty'),
      onPress: () => navigation.navigate('PlayerList', { peladaId }),
    },
    {
      featherIcon: 'clock',
      iconBg: '#CCFBF1',
      iconColor: '#0F766E',
      title: t('peladaHub.history'),
      subtitle: lastDrawDate
        ? t('peladaHub.lastDraw', { date: formatShortDate(lastDrawDate), count: drawCount })
        : t('peladaHub.noDraw'),
      onPress: () => navigation.navigate('DrawHistory', { peladaId }),
    },
    {
      featherIcon: 'award',
      iconBg: '#FEF3C7',
      iconColor: '#B45309',
      title: t('peladaHub.ranking'),
      subtitle: rankedDraws > 0
        ? t('peladaHub.rankingDesc', { count: rankedDraws })
        : t('peladaHub.rankingEmpty'),
      onPress: () => navigation.navigate('Ranking', { peladaId }),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {actions.map((action, i) => (
          <TouchableOpacity key={i} style={styles.card} onPress={action.onPress} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: action.iconBg }]}>
              <Feather name={action.featherIcon} size={22} color={action.iconColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardSubtitle}>{action.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.border} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 20 },
    actions: { gap: 14, marginTop: 8 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 6,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardText: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    cardSubtitle: { fontSize: 13, color: c.textSecondary },
  });
}
