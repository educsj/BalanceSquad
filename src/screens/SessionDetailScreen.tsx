import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, Pelada, PeladaSession, Player, StarLevel, Gender } from '../types';
import {
  getPeladaById, rsvpToSession, cancelRsvp, setSessionStatus, removeSession, addSessionGuest,
} from '../storage';
import { useTheme, ThemeColors } from '../theme';
import StarRating from '../components/StarRating';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type RouteProps = RouteProp<RootStackParamList, 'SessionDetail'>;
type Nav = StackNavigationProp<RootStackParamList>;

function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const [year, month, day] = iso.split('-');
  const d = new Date(`${iso}T00:00:00`);
  const weekday = t(`calendar.weekday.${d.getDay()}`);
  const monthName = t(`calendar.month.${parseInt(month, 10)}`);
  return `${weekday}, ${parseInt(day, 10)} ${monthName} ${year}`;
}

export default function SessionDetailScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [pelada, setPelada] = useState<Pelada | null>(null);
  const [session, setSession] = useState<PeladaSession | null>(null);
  const [confirmPickerOpen, setConfirmPickerOpen] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestLevel, setNewGuestLevel] = useState<StarLevel>(3);
  const [newGuestGender, setNewGuestGender] = useState<Gender | undefined>(undefined);

  const reload = useCallback(async () => {
    const p = await getPeladaById(params.peladaId);
    if (!p) return;
    setPelada(p);
    const found = (p.sessions ?? []).find(s => s.id === params.sessionId);
    setSession(found ?? null);
  }, [params.peladaId, params.sessionId]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Map player ids → Player for the lists. Merges pelada roster + session
  // guests so confirmed/waitlisted avulsos render with name + ★.
  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    pelada?.players.forEach(pl => map.set(pl.id, pl));
    session?.guestPlayers?.forEach(pl => map.set(pl.id, pl));
    return map;
  }, [pelada, session]);

  // Guests can only have their name resolved through session.guestPlayers, so
  // the UI uses this set to render a "Avulso" chip next to their name.
  const guestIds = useMemo(() => {
    return new Set((session?.guestPlayers ?? []).map(g => g.id));
  }, [session]);

  // Pool of players NOT yet confirmed or waitlisted, for the "Confirmar como…"
  // picker. Sorted alphabetically.
  const availableToConfirm = useMemo(() => {
    if (!pelada || !session) return [];
    const placed = new Set([...session.rsvps, ...session.waitlist]);
    return pelada.players
      .filter(p => !placed.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pelada, session]);

  if (!pelada || !session) {
    return <View style={styles.container} />;
  }

  const isPast = session.date < todayLocalIso();
  const isToday = session.date === todayLocalIso();
  const isCancelled = session.status === 'cancelled';
  const isCompleted = session.status === 'completed';
  const isFull = session.rsvps.length >= session.maxPlayers;

  // Stays open after each pick so the organizer can batch-confirm a bunch of
  // players in a row. The picker list updates live (recently-confirmed players
  // drop out via reload), and the user closes the modal manually when done.
  async function handleConfirm(playerId: string) {
    if (!session) return;
    const outcome = await rsvpToSession(params.peladaId, session.id, playerId);
    if (outcome === 'confirmed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (outcome === 'waitlisted') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    await reload();
  }

  async function handleRemove(playerId: string, playerName: string) {
    if (!session) return;
    Alert.alert(
      t('sessions.removeTitle', { name: playerName }),
      t('sessions.removeMsg', { name: playerName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            await cancelRsvp(params.peladaId, session.id, playerId);
            await reload();
          },
        },
      ],
    );
  }

  async function handleCancelSession() {
    if (!session) return;
    Alert.alert(
      t('sessions.cancelSessionTitle'),
      t('sessions.cancelSessionMsg'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: async () => {
            await setSessionStatus(params.peladaId, session.id, 'cancelled');
            await reload();
          },
        },
      ],
    );
  }

  async function handleDeleteSession() {
    if (!session) return;
    Alert.alert(
      t('sessions.deleteTitle'),
      t('sessions.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await removeSession(params.peladaId, session.id);
            navigation.goBack();
          },
        },
      ],
    );
  }

  function handleDrawNow() {
    if (!session) return;
    // Pré-seleciona os jogadores confirmados na sessão. RSVPs podem incluir
    // ids de jogadores avulsos (guestPlayers) — esses não estão em
    // pelada.players, então passamos eles via `guestPlayers` (o DrawConfig
    // já mescla com `selectedPlayerIds`).
    const guestIdsInRsvp = new Set(session.guestPlayers?.map(g => g.id) ?? []);
    const regularSelected = session.rsvps.filter(id => !guestIdsInRsvp.has(id));
    const guestsInRsvp = (session.guestPlayers ?? []).filter(g => session.rsvps.includes(g.id));
    navigation.navigate('DrawConfig', {
      peladaId: params.peladaId,
      selectedPlayerIds: regularSelected,
      guestPlayers: guestsInRsvp,
    });
  }

  function openGuestModal() {
    setNewGuestName('');
    setNewGuestLevel(3);
    setNewGuestGender(undefined);
    setConfirmPickerOpen(false);
    setGuestModalOpen(true);
  }

  async function handleCreateGuest() {
    if (!session) return;
    const name = newGuestName.trim();
    if (!name) return;
    const guest: Player = {
      id: generateId(),
      name,
      level: newGuestLevel,
      ...(newGuestGender ? { gender: newGuestGender } : {}),
    };
    setGuestModalOpen(false);
    const outcome = await addSessionGuest(params.peladaId, session.id, guest);
    if (outcome === 'confirmed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (outcome === 'waitlisted') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    await reload();
    // Reopen the picker so the organizer can keep adding (regulars or guests).
    setConfirmPickerOpen(true);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Header card with date + status */}
        <View style={styles.headerCard}>
          <Feather name="calendar" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerDate}>{formatDateLong(session.date, t)}</Text>
            {session.time && (
              <Text style={styles.headerTime}>{session.time}</Text>
            )}
          </View>
          {isCancelled && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(185,28,28,0.15)' }]}>
              <Text style={[styles.statusBadgeText, { color: colors.danger }]}>
                {t('sessions.statusCancelled')}
              </Text>
            </View>
          )}
          {isCompleted && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.18)' }]}>
              <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>
                {t('sessions.statusCompleted')}
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {session.notes && (
          <View style={styles.notesCard}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={styles.notesText}>{session.notes}</Text>
          </View>
        )}

        {/* Capacity bar */}
        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>
            {t('sessions.rsvpCount', { confirmed: session.rsvps.length, max: session.maxPlayers })}
          </Text>
          {isFull && !isCancelled && (
            <View style={styles.fullChip}>
              <Text style={styles.fullChipText}>{t('sessions.fullChip')}</Text>
            </View>
          )}
        </View>

        {/* Confirmed players */}
        <Text style={styles.sectionTitle}>{t('sessions.confirmedSection')}</Text>
        {session.rsvps.length === 0 ? (
          <Text style={styles.emptySection}>{t('sessions.noConfirmed')}</Text>
        ) : (
          session.rsvps.map(playerId => {
            const player = playerById.get(playerId);
            const name = player?.name ?? t('sessions.unknownPlayer');
            const isGuest = guestIds.has(playerId);
            return (
              <View key={playerId} style={styles.playerRow}>
                <Feather name="check-circle" size={16} color="#15803D" />
                <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
                {isGuest && (
                  <View style={styles.guestChip}>
                    <Text style={styles.guestChipText}>{t('sessions.guestChip')}</Text>
                  </View>
                )}
                {!isCancelled && !isCompleted && (
                  <TouchableOpacity
                    onPress={() => handleRemove(playerId, name)}
                    style={styles.removeIcon}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* Waitlist */}
        {session.waitlist.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
              {t('sessions.waitlistSection')}
            </Text>
            {session.waitlist.map((playerId, idx) => {
              const player = playerById.get(playerId);
              const name = player?.name ?? t('sessions.unknownPlayer');
              const isGuest = guestIds.has(playerId);
              return (
                <View key={playerId} style={styles.playerRow}>
                  <View style={styles.waitlistOrderBubble}>
                    <Text style={styles.waitlistOrderText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
                  {isGuest && (
                    <View style={styles.guestChip}>
                      <Text style={styles.guestChipText}>{t('sessions.guestChip')}</Text>
                    </View>
                  )}
                  {!isCancelled && !isCompleted && (
                    <TouchableOpacity
                      onPress={() => handleRemove(playerId, name)}
                      style={styles.removeIcon}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Organizer actions */}
        {!isCancelled && !isCompleted && (
          <View style={styles.adminBlock}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
              {t('sessions.organizerActions')}
            </Text>
            <TouchableOpacity style={styles.adminBtn} onPress={handleCancelSession} activeOpacity={0.8}>
              <Feather name="slash" size={14} color={colors.danger} />
              <Text style={[styles.adminBtnText, { color: colors.danger }]}>
                {t('sessions.cancelSessionCta')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminBtn} onPress={handleDeleteSession} activeOpacity={0.8}>
              <Feather name="trash-2" size={14} color={colors.danger} />
              <Text style={[styles.adminBtnText, { color: colors.danger }]}>
                {t('sessions.deleteCta')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      {!isCancelled && !isCompleted && (
        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          {(isToday || isPast) && session.rsvps.length > 0 ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleDrawNow} activeOpacity={0.85}>
              <Feather name="shuffle" size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>{t('sessions.drawNowCta')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, availableToConfirm.length === 0 && styles.btnDisabled]}
              onPress={() => setConfirmPickerOpen(true)}
              disabled={availableToConfirm.length === 0}
              activeOpacity={0.85}
            >
              <Feather name="user-check" size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>{t('sessions.confirmAsCta')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Confirm-as picker modal */}
      <Modal
        visible={confirmPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setConfirmPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pickerModal}>
            <Text style={styles.modalTitle}>{t('sessions.pickerTitle')}</Text>
            <Text style={styles.modalSubtitle}>
              {isFull ? t('sessions.pickerSubtitleFull') : t('sessions.pickerSubtitle')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {availableToConfirm.length === 0 ? (
                <Text style={styles.emptySection}>{t('sessions.pickerEmpty')}</Text>
              ) : (
                availableToConfirm.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pickerRow}
                    onPress={() => handleConfirm(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerName} numberOfLines={1}>{p.name}</Text>
                    <Feather
                      name={isFull ? 'clock' : 'plus-circle'}
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={styles.btnGuest}
                onPress={openGuestModal}
                activeOpacity={0.8}
              >
                <Feather name="user-plus" size={14} color={colors.primary} />
                <Text style={styles.btnGuestText}>{t('sessions.addGuestCta')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDone}
                onPress={() => setConfirmPickerOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnDoneText}>{t('sessions.pickerDoneCta')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Guest creation modal */}
      <Modal
        visible={guestModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGuestModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.modalTitle}>{t('sessions.guestModalTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('sessions.guestModalSubtitle')}</Text>
            <TextInput
              style={styles.guestInput}
              placeholder={t('sessions.guestNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newGuestName}
              onChangeText={setNewGuestName}
              autoFocus
              maxLength={40}
            />
            <View style={styles.guestLevelRow}>
              <Text style={styles.guestLevelLabel}>{t('sessions.guestLevelLabel')}</Text>
              <StarRating value={newGuestLevel} onChange={lvl => setNewGuestLevel(lvl)} size={26} />
            </View>
            <View style={styles.guestGenderRow}>
              {([
                { value: undefined, key: 'none' },
                { value: 'M' as const, key: 'male' },
                { value: 'F' as const, key: 'female' },
              ]).map(opt => {
                const active = newGuestGender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.guestGenderBtn, active && styles.guestGenderBtnActive]}
                    onPress={() => setNewGuestGender(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.guestGenderBtnText, active && styles.guestGenderBtnTextActive]}>
                      {t(`playerRegister.gender.${opt.key}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={styles.btnDone}
                onPress={() => { setGuestModalOpen(false); setConfirmPickerOpen(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.btnDoneText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGuestPrimary, !newGuestName.trim() && styles.btnDisabled]}
                onPress={handleCreateGuest}
                disabled={!newGuestName.trim()}
                activeOpacity={0.85}
              >
                <Feather name="check" size={14} color="#fff" />
                <Text style={styles.btnGuestPrimaryText}>{t('common.add')}</Text>
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
    container: { flex: 1, backgroundColor: c.background },

    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      margin: 16,
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 12,
      elevation: 2,
    },
    headerDate: { fontSize: 16, fontWeight: '700', color: c.text },
    headerTime: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

    notesCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
    },
    notesText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },

    capacityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    capacityLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    fullChip: {
      backgroundColor: 'rgba(185,28,28,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    fullChipText: { fontSize: 11, fontWeight: '800', color: c.danger, textTransform: 'uppercase' },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      marginTop: 10,
      marginBottom: 6,
    },
    emptySection: {
      fontSize: 13,
      color: c.textMuted,
      fontStyle: 'italic',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    playerName: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    removeIcon: { paddingHorizontal: 6, paddingVertical: 4 },
    waitlistOrderBubble: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waitlistOrderText: { fontSize: 11, fontWeight: '800', color: c.textSecondary },

    adminBlock: { marginTop: 20, paddingHorizontal: 16, gap: 8, paddingBottom: 24 },
    adminBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: 'rgba(185,28,28,0.35)',
      borderRadius: 10,
      backgroundColor: 'rgba(185,28,28,0.08)',
    },
    adminBtnText: { fontWeight: '700', fontSize: 14 },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      elevation: 3,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    btnDisabled: { backgroundColor: c.disabled },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    pickerModal: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      gap: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    modalSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: -6 },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
      marginBottom: 6,
    },
    pickerName: { fontSize: 14, color: c.text, fontWeight: '600', flex: 1 },
    btnSecondary: {
      backgroundColor: c.borderLight,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },

    pickerFooter: { flexDirection: 'row', gap: 8, marginTop: 4 },
    btnGuest: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    btnGuestText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    btnDone: {
      flex: 1,
      backgroundColor: c.borderLight,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnDoneText: { color: c.text, fontWeight: '600', fontSize: 15 },

    btnGuestPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 13,
    },
    btnGuestPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    guestInput: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 15,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    guestLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    guestLevelLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    guestGenderRow: { flexDirection: 'row', gap: 8 },
    guestGenderBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      backgroundColor: c.surfaceVariant,
    },
    guestGenderBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    guestGenderBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    guestGenderBtnTextActive: { color: c.primary, fontWeight: '700' },

    guestChip: {
      backgroundColor: c.primaryLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    guestChipText: { color: c.primary, fontWeight: '700', fontSize: 10, textTransform: 'uppercase' },
  });
}
