import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Player, StarLevel, RootStackParamList } from '../types';
import { getPeladaById, updatePelada, getHideRatings } from '../storage';
import StarRating from '../components/StarRating';
import EmptyState from '../components/EmptyState';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'PlayerList'>;
type Nav = StackNavigationProp<RootStackParamList>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function PlayerListScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId } = params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideRatings, setHideRatingsState] = useState(false);

  const [guestPlayers, setGuestPlayers] = useState<Player[]>([]);
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestLevel, setNewGuestLevel] = useState<StarLevel>(3);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getPeladaById(peladaId), getHideRatings()]).then(([pelada, hide]) => {
        if (!pelada) return;
        const list = pelada.players;
        setPlayers(list);
        setHideRatingsState(hide);
        setSelected(prev => {
          const valid = new Set(list.map(p => p.id));
          return new Set([...prev].filter(id => valid.has(id)));
        });
      });
    }, [peladaId])
  );

  function toggle(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = [...players.map(p => p.id), ...guestPlayers.map(p => p.id)];
    const allSelected = allIds.every(id => selected.has(id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function handleDelete(id: string) {
    Alert.alert(t('playerList.removePlayer'), t('playerList.removeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'), style: 'destructive', onPress: async () => {
          const pelada = await getPeladaById(peladaId);
          if (!pelada) return;
          const updated = pelada.players.filter(p => p.id !== id);
          await updatePelada({ ...pelada, players: updated });
          setPlayers(updated);
          setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
        },
      },
    ]);
  }

  function removeGuest(id: string) {
    setGuestPlayers(prev => prev.filter(g => g.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  function openGuestModal() {
    setNewGuestName('');
    setNewGuestLevel(3);
    setGuestModalVisible(true);
  }

  function addGuest() {
    const name = newGuestName.trim();
    if (!name) return;
    const guest: Player = { id: generateId(), name, level: newGuestLevel };
    setGuestPlayers(prev => [...prev, guest]);
    setSelected(prev => new Set([...prev, guest.id]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setGuestModalVisible(false);
  }

  function handleContinue() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const selectedGuestPlayers = guestPlayers.filter(g => selected.has(g.id));
    navigation.navigate('DrawConfig', {
      peladaId,
      selectedPlayerIds: [...selected].filter(id => !guestPlayers.some(g => g.id === id)),
      guestPlayers: selectedGuestPlayers.length > 0 ? selectedGuestPlayers : undefined,
    });
  }

  const totalSelected = selected.size;
  const totalCount = players.length + guestPlayers.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {t('playerList.selected', { selected: totalSelected, total: totalCount })}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openGuestModal} style={styles.guestBtn}>
            <Feather name="user-plus" size={13} color={colors.primary} />
            <Text style={styles.guestBtnText}>{t('playerList.guest')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleAll}>
            <Text style={styles.toggleAll}>
              {totalSelected === totalCount && totalCount > 0
                ? t('playerList.deselectAll')
                : t('playerList.selectAll')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[...players, ...guestPlayers]}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const isGuest = guestPlayers.some(g => g.id === item.id);
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                isGuest && styles.cardGuest,
              ]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkCircle, isGuest && styles.checkCircleGuest]}>
                {isSelected && <Feather name="check" size={13} color={isGuest ? '#7C3AED' : colors.primary} />}
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.cardName, isSelected && styles.cardNameSelected]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {isGuest && (
                    <View style={styles.guestBadge}>
                      <Text style={styles.guestBadgeText}>{t('playerList.guest')}</Text>
                    </View>
                  )}
                </View>
                {!hideRatings && <StarRating value={item.level} readonly size={14} />}
              </View>
              <View style={styles.cardActions}>
                {isGuest ? (
                  <TouchableOpacity
                    onPress={() => removeGuest(item.id)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('PlayerRegister', { peladaId, editPlayerId: item.id })}
                      style={styles.actionBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Feather name="edit-2" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      style={styles.actionBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={
          <EmptyState
            icon="user-plus"
            title={t('playerList.emptyTitle')}
            subtitle={t('playerList.emptySubtitle')}
            actionLabel={t('playerList.emptyAction')}
            onAction={() => navigation.navigate('PlayerRegister', { peladaId })}
          />
        }
      />

      <TouchableOpacity
        style={[styles.continueBtn, totalSelected < 2 && styles.continueBtnDisabled, { bottom: 24 + insets.bottom }]}
        onPress={handleContinue}
        disabled={totalSelected < 2}
      >
        <Text style={styles.continueBtnText}>
          {totalSelected < 2
            ? t('playerList.minPlayersHint')
            : t('playerList.continueBtn', { count: totalSelected })}
        </Text>
      </TouchableOpacity>

      <Modal visible={guestModalVisible} transparent animationType="fade" onRequestClose={() => setGuestModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('playerList.addGuest')}</Text>
            <Text style={styles.modalSub}>{t('playerList.guestDesc')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('playerList.guestName')}
              placeholderTextColor={colors.textMuted}
              value={newGuestName}
              onChangeText={setNewGuestName}
              autoFocus
            />
            <View style={styles.levelRow}>
              <Text style={styles.levelLabel}>{t('playerList.levelLabel')}</Text>
              <StarRating value={newGuestLevel} onChange={lvl => setNewGuestLevel(lvl)} size={28} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setGuestModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={addGuest}>
                <Text style={styles.btnPrimaryText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    toggleAll: { color: c.primary, fontSize: 13, fontWeight: '600' },
    guestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    guestBtnText: { color: c.primary, fontSize: 12, fontWeight: '700' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    cardSelected: { borderColor: c.primary, backgroundColor: c.primaryLight },
    cardGuest: { borderStyle: 'dashed', borderColor: '#7C3AED' },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkCircleGuest: { borderColor: '#7C3AED' },
    cardInfo: { flex: 1, gap: 3 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    cardName: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    cardNameSelected: { color: c.text },
    guestBadge: { backgroundColor: '#EDE9FE', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
    guestBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
    cardActions: { flexDirection: 'row', gap: 8, flexShrink: 0, alignItems: 'center' },
    actionBtn: { padding: 4 },
    continueBtn: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      elevation: 6,
      shadowColor: c.primary,
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    continueBtnDisabled: { backgroundColor: c.disabled, elevation: 0, shadowOpacity: 0 },
    continueBtnText: { color: c.textOnPrimary, fontWeight: '700', fontSize: 15 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 14 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    modalSub: { fontSize: 12, color: c.textSecondary, marginTop: -6 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 11,
      fontSize: 15,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    levelLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnPrimary: { flex: 1, backgroundColor: c.primary, borderRadius: 8, padding: 13, alignItems: 'center' },
    btnPrimaryText: { color: c.textOnPrimary, fontWeight: '700', fontSize: 15 },
    btnSecondary: { flex: 1, backgroundColor: c.borderLight, borderRadius: 8, padding: 13, alignItems: 'center' },
    btnSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },
  });
}
