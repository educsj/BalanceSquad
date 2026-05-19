import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { Pelada, RootStackParamList } from '../types';
import {
  loadPeladas, savePeladas, getHideRatings, setHideRatings,
  exportData, importData, setLanguage, setThemeMode, ThemeMode,
  getOnboardingSeen, setOnboardingSeen,
  getNotifSessionEnabled, setNotifSessionEnabled,
  getNotifLeadHours, setNotifLeadHours,
  getNotifAdminEnabled, setNotifAdminEnabled,
  getNotifAdminDayOfWeek, setNotifAdminDayOfWeek,
  getNotifAdminTime, setNotifAdminTime,
  getNotifAdminId, setNotifAdminId,
} from '../storage';
import {
  ensureNotifPermission,
  cancelNotification,
  scheduleWeeklyAdminReminder,
} from '../utils/notifications';
import { parseDrawPayload, importDrawAsPelada } from '../utils/drawShare';
import EmptyState from '../components/EmptyState';
import i18n, { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { useTheme, ThemeColors } from '../theme';

type Nav = StackNavigationProp<RootStackParamList, 'Home'>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode: themeMode, setMode: setThemeModeState } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleThemeChange(next: ThemeMode) {
    setThemeModeState(next);
    await setThemeMode(next);
  }

  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPlayersPerTeam, setNewPlayersPerTeam] = useState('');
  const [hideRatings, setHideRatingsState] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Notification preferences — loaded on focus when the settings modal opens.
  const [notifSessionEnabled, setNotifSessionEnabledState] = useState(false);
  const [notifLeadHours, setNotifLeadHoursState] = useState(2);
  const [notifAdminEnabled, setNotifAdminEnabledState] = useState(false);
  const [notifAdminDow, setNotifAdminDowState] = useState(4);
  const [notifAdminTime, setNotifAdminTimeState] = useState('18:00');

  useFocusEffect(
    useCallback(() => {
      loadPeladas().then(setPeladas);
      getHideRatings().then(setHideRatingsState);
      getOnboardingSeen().then(seen => setShowOnboarding(!seen));
      getNotifSessionEnabled().then(setNotifSessionEnabledState);
      getNotifLeadHours().then(setNotifLeadHoursState);
      getNotifAdminEnabled().then(setNotifAdminEnabledState);
      getNotifAdminDayOfWeek().then(setNotifAdminDowState);
      getNotifAdminTime().then(setNotifAdminTimeState);
    }, [])
  );

  async function dismissOnboarding() {
    setShowOnboarding(false);
    await setOnboardingSeen(true);
  }

  async function toggleHideRatings() {
    const next = !hideRatings;
    setHideRatingsState(next);
    await setHideRatings(next);
  }

  // Session reminder toggle — asks permission on enable; saves regardless so
  // the user can flip it back on later without surprises.
  async function handleToggleNotifSession() {
    const next = !notifSessionEnabled;
    if (next) {
      const granted = await ensureNotifPermission();
      if (!granted) return; // permission denied; keep toggle off
    }
    setNotifSessionEnabledState(next);
    await setNotifSessionEnabled(next);
  }

  async function handleLeadHoursChange(hours: number) {
    setNotifLeadHoursState(hours);
    await setNotifLeadHours(hours);
  }

  // Admin weekly toggle — schedules/replaces the recurring notification.
  async function handleToggleNotifAdmin() {
    const next = !notifAdminEnabled;
    const existingId = await getNotifAdminId();
    if (existingId) {
      await cancelNotification(existingId);
      await setNotifAdminId(null);
    }
    if (next) {
      const granted = await ensureNotifPermission();
      if (!granted) return;
      const id = await scheduleWeeklyAdminReminder(notifAdminDow, notifAdminTime);
      if (id) await setNotifAdminId(id);
    }
    setNotifAdminEnabledState(next);
    await setNotifAdminEnabled(next);
  }

  // When the user shifts day/time and the admin toggle is ON, replace the
  // scheduled notification so it fires at the new slot.
  async function handleAdminDowChange(dow: number) {
    setNotifAdminDowState(dow);
    await setNotifAdminDayOfWeek(dow);
    if (notifAdminEnabled) {
      await rescheduleAdmin(dow, notifAdminTime);
    }
  }

  async function handleAdminTimeChange(time: string) {
    setNotifAdminTimeState(time);
    if (/^\d{2}:\d{2}$/.test(time)) {
      await setNotifAdminTime(time);
      if (notifAdminEnabled) {
        await rescheduleAdmin(notifAdminDow, time);
      }
    }
  }

  async function rescheduleAdmin(dow: number, time: string) {
    const existingId = await getNotifAdminId();
    if (existingId) {
      await cancelNotification(existingId);
      await setNotifAdminId(null);
    }
    const id = await scheduleWeeklyAdminReminder(dow, time);
    if (id) await setNotifAdminId(id);
  }

  function openCreateModal() {
    setEditingId(null);
    setNewName('');
    setNewPlayersPerTeam('');
    setModalVisible(true);
  }

  function openEditModal(pelada: Pelada) {
    setEditingId(pelada.id);
    setNewName(pelada.name);
    setNewPlayersPerTeam(String(pelada.playersPerTeam));
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingId(null);
  }

  async function handleSubmit() {
    const name = newName.trim();
    if (!name) return;
    const playersPerTeam = parseInt(newPlayersPerTeam, 10);
    if (!playersPerTeam || playersPerTeam < 1) {
      Alert.alert(t('home.invalidValue'), t('home.invalidValueMsg'));
      return;
    }

    let updated: Pelada[];
    if (editingId) {
      updated = peladas.map(p =>
        p.id === editingId ? { ...p, name, playersPerTeam } : p
      );
    } else {
      const nova: Pelada = { id: generateId(), name, playersPerTeam, players: [] };
      updated = [...peladas, nova];
    }

    setPeladas(updated);
    await savePeladas(updated);
    closeModal();
  }

  async function handleDelete(id: string) {
    Alert.alert(t('home.removePelada'), t('home.removePeladaMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'), style: 'destructive', onPress: async () => {
          const updated = peladas.filter(p => p.id !== id);
          setPeladas(updated);
          await savePeladas(updated);
        },
      },
    ]);
  }

  async function handleExport() {
    try {
      const json = await exportData();
      const filename = `balancesquad-backup-${Date.now()}.json`;
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: t('home.exportDataLabel') });
      }
    } catch {
      Alert.alert(t('common.error'), t('home.exportError'));
    }
    setBackupModalVisible(false);
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });

      Alert.alert(
        t('home.importData'),
        t('home.importConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('home.importLabel'), style: 'destructive', onPress: async () => {
              const ok = await importData(json);
              if (!ok) {
                Alert.alert(t('common.error'), t('home.importError'));
                return;
              }
              const updated = await loadPeladas();
              setPeladas(updated);
              setBackupModalVisible(false);
              Alert.alert(t('common.success'), t('home.importSuccess'));
            },
          },
        ]
      );
    } catch {
      Alert.alert(t('common.error'), t('home.importError'));
    }
  }

  async function handleImportDraw() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });

      const payload = parseDrawPayload(json);
      if (!payload) {
        Alert.alert(t('common.error'), t('home.importDrawInvalid'));
        return;
      }

      const players = payload.teams.reduce((s, x) => s + x.players.length, 0);

      // Already-imported check: a pelada whose name starts with the source
      // and whose drawHistory has an entry with the exact same timestamp is
      // almost certainly the same draw. Warn before creating a duplicate.
      const existing = peladas.find(p =>
        p.name.startsWith(payload.sourcePeladaName)
        && (p.drawHistory ?? []).some(r => r.timestamp === payload.timestamp)
      );

      const proceedToImport = async () => {
        const pelada = await importDrawAsPelada(payload, t('home.importedSuffix'));
        const updated = await loadPeladas();
        setPeladas(updated);
        setBackupModalVisible(false);
        Alert.alert(t('common.success'), t('home.importDrawSuccess', { name: pelada.name }));
      };

      if (existing) {
        Alert.alert(
          t('home.importDrawDuplicateTitle'),
          t('home.importDrawDuplicateMsg', { name: existing.name }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('home.importLabel'), onPress: proceedToImport },
          ]
        );
        return;
      }

      Alert.alert(
        t('home.importDrawConfirmTitle'),
        t('home.importDrawConfirmMsg', {
          name: payload.sourcePeladaName,
          teams: payload.teams.length,
          players,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('home.importLabel'), onPress: proceedToImport },
        ]
      );
    } catch {
      Alert.alert(t('common.error'), t('home.importError'));
    }
  }

  async function handleLanguageChange(lang: SupportedLanguage) {
    await i18n.changeLanguage(lang);
    await setLanguage(lang);
    setLangModalVisible(false);
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{t('home.title')}</Text>
            <Text style={styles.headerSub}>{t('home.subtitle')}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setLangModalVisible(true)} activeOpacity={0.8}>
              <Text style={styles.flagEmoji}>{currentLang.flag}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setBackupModalVisible(true)} activeOpacity={0.8}>
              <Feather name="settings" size={20} color={colors.headerSub} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={toggleHideRatings} activeOpacity={0.8}>
              <Feather name={hideRatings ? 'eye-off' : 'eye'} size={20} color={colors.headerSub} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {peladas.length === 0
          ? t('home.emptyTitle')
          : t('home.peladasCount', { count: peladas.length })}
      </Text>

      {showOnboarding && (
        <View style={styles.onboardCard}>
          <View style={styles.onboardHeader}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={styles.onboardTitle}>{t('home.onboarding.title')}</Text>
            <TouchableOpacity
              onPress={dismissOnboarding}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {['step1', 'step2', 'step3', 'step4'].map((k, i) => (
            <View key={k} style={styles.onboardStep}>
              <View style={styles.onboardStepBadge}>
                <Text style={styles.onboardStepBadgeText}>{i + 1}</Text>
              </View>
              <Text style={styles.onboardStepText}>{t(`home.onboarding.${k}`)}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={peladas}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const drawCount = item.drawHistory?.length ?? 0;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PeladaHub', { peladaId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {drawCount > 0 && (
                    <View style={styles.drawBadge}>
                      <Text style={styles.drawBadgeText}>
                        {t('home.drawSaved', { count: drawCount })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardMeta}>
                  {t('home.playersInfo', { count: item.players.length, playersPerTeam: item.playersPerTeam })}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Feather name="edit-2" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Feather name="trash-2" size={17} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title={t('home.emptyTitle')}
            subtitle={t('home.emptySubtitle')}
            actionLabel={t('home.emptyAction')}
            onAction={openCreateModal}
          />
        }
      />

      <TouchableOpacity style={[styles.fab, { bottom: 28 + insets.bottom }]} onPress={openCreateModal}>
        <Feather name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create / Edit modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingId ? t('home.editPelada') : t('home.newPelada')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('home.peladaNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder={t('home.playersPerTeamPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newPlayersPerTeam}
              onChangeText={setNewPlayersPerTeam}
              keyboardType="number-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={closeModal}>
                <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit}>
                <Text style={styles.btnPrimaryText}>{editingId ? t('common.save') : t('common.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Backup modal */}
      <Modal visible={backupModalVisible} transparent animationType="fade" onRequestClose={() => setBackupModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>{t('home.backupTitle')}</Text>
            <Text style={styles.modalSub}>{t('home.backupDesc')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>{t('home.themeLabel')}</Text>
            <View style={styles.themeRow}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map(m => {
                const active = themeMode === m;
                const icon = m === 'system' ? 'smartphone' : m === 'light' ? 'sun' : 'moon';
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.themeBtn, active && styles.themeBtnActive]}
                    onPress={() => handleThemeChange(m)}
                    activeOpacity={0.85}
                  >
                    <Feather name={icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.themeBtnText, active && styles.themeBtnTextActive]}>
                      {t(`home.theme.${m}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ─── Notifications block ─────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>{t('home.notifLabel')}</Text>

            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{t('home.notifSessionTitle')}</Text>
                <Text style={styles.notifDesc}>{t('home.notifSessionDesc')}</Text>
              </View>
              <Switch
                value={notifSessionEnabled}
                onValueChange={handleToggleNotifSession}
                trackColor={{ false: colors.borderLight, true: colors.primary }}
              />
            </View>

            {notifSessionEnabled && (
              <View style={styles.notifSub}>
                <Text style={styles.notifSubLabel}>{t('home.notifLeadLabel')}</Text>
                <View style={styles.notifChipRow}>
                  {[1, 2, 4, 24].map(h => {
                    const active = notifLeadHours === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.notifChip, active && styles.notifChipActive]}
                        onPress={() => handleLeadHoursChange(h)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.notifChipText, active && styles.notifChipTextActive]}>
                          {h === 24 ? t('home.notifLeadDay') : t('home.notifLeadHours', { count: h })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{t('home.notifAdminTitle')}</Text>
                <Text style={styles.notifDesc}>{t('home.notifAdminDesc')}</Text>
              </View>
              <Switch
                value={notifAdminEnabled}
                onValueChange={handleToggleNotifAdmin}
                trackColor={{ false: colors.borderLight, true: colors.primary }}
              />
            </View>

            {notifAdminEnabled && (
              <View style={styles.notifSub}>
                <Text style={styles.notifSubLabel}>{t('home.notifDowLabel')}</Text>
                <View style={styles.notifChipRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const active = notifAdminDow === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.notifDowChip, active && styles.notifChipActive]}
                        onPress={() => handleAdminDowChange(d)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.notifChipText, active && styles.notifChipTextActive]}>
                          {t(`calendar.weekday.${d}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.notifSubLabel, { marginTop: 10 }]}>
                  {t('home.notifTimeLabel')}
                </Text>
                <TextInput
                  style={styles.notifTimeInput}
                  value={notifAdminTime}
                  onChangeText={handleAdminTimeChange}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            )}

            {/* ────────────────────────────────────────────────────────────── */}

            <TouchableOpacity style={styles.backupBtn} onPress={handleExport}>
              <Feather name="upload" size={22} color="#fff" />
              <View>
                <Text style={styles.backupBtnTitle}>{t('home.exportDataLabel')}</Text>
                <Text style={styles.backupBtnSub}>{t('home.exportDataDesc')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backupBtn, styles.backupBtnSecondary]} onPress={handleImport}>
              <Feather name="download" size={22} color={colors.primary} />
              <View>
                <Text style={[styles.backupBtnTitle, { color: colors.text }]}>{t('home.importDataLabel')}</Text>
                <Text style={[styles.backupBtnSub, { color: colors.textSecondary }]}>{t('home.importDataDesc')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backupBtn, styles.backupBtnSecondary]} onPress={handleImportDraw}>
              <Feather name="file-text" size={22} color={colors.primary} />
              <View>
                <Text style={[styles.backupBtnTitle, { color: colors.text }]}>{t('home.importDrawLabel')}</Text>
                <Text style={[styles.backupBtnSub, { color: colors.textSecondary }]}>{t('home.importDrawDesc')}</Text>
              </View>
            </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.btnSecondary} onPress={() => setBackupModalVisible(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language modal */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🌐 Language / Idioma</Text>
            {SUPPORTED_LANGUAGES.map(lang => {
              const isActive = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, isActive && styles.langOptionActive]}
                  onPress={() => handleLanguageChange(lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, isActive && styles.langLabelActive]}>{lang.label}</Text>
                  {isActive && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setLangModalVisible(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.headerBg,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitles: { flex: 1 },
    headerTitle: { color: c.headerText, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
    headerSub: { color: c.headerSub, fontSize: 13, marginTop: 3 },
    headerIcons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.headerBtnBg,
      borderRadius: 10,
    },
    flagEmoji: { fontSize: 20 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '500', margin: 16, marginBottom: 8 },
    onboardCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.borderLight,
      gap: 8,
    },
    onboardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    onboardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
    onboardStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    onboardStepBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onboardStepBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
    onboardStepText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 6,
    },
    cardLeft: { flex: 1 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    cardName: { fontSize: 16, fontWeight: '700', color: c.text },
    drawBadge: {
      backgroundColor: c.badgeBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    drawBadgeText: { fontSize: 10, fontWeight: '700', color: c.badgeText, letterSpacing: 0.3 },
    cardMeta: { fontSize: 12, color: c.textSecondary, marginTop: 3 },
    cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    actionBtn: { padding: 4 },
    fab: {
      position: 'absolute',
      bottom: 28,
      right: 24,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: c.primary,
      shadowOpacity: 0.45,
      shadowRadius: 10,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    modal: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      gap: 14,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    modalSub: { fontSize: 13, color: c.textSecondary, marginTop: -6 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      padding: 11,
      fontSize: 15,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btnPrimary: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 13,
      alignItems: 'center',
    },
    btnPrimaryText: { color: c.textOnPrimary, fontWeight: '700', fontSize: 15 },
    btnSecondary: {
      flex: 1,
      backgroundColor: c.borderLight,
      borderRadius: 8,
      padding: 13,
      alignItems: 'center',
    },
    btnSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
    },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    themeBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    themeBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    themeBtnTextActive: { color: c.primary, fontWeight: '700' },

    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    notifTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    notifDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    notifSub: {
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
      padding: 12,
      gap: 6,
    },
    notifSubLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    notifChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    notifChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
    },
    notifDowChip: {
      width: 38,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    notifChipActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    notifChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
    notifChipTextActive: { color: c.primary },
    notifTimeInput: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: c.inputText,
      backgroundColor: c.inputBg,
      width: 100,
    },
    backupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 16,
    },
    backupBtnSecondary: { backgroundColor: c.borderLight },
    backupBtnTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    backupBtnSub: { fontSize: 12, color: c.headerSub, marginTop: 2 },
    langOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    langOptionActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    langFlag: { fontSize: 22 },
    langLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: c.textSecondary },
    langLabelActive: { color: c.text },
  });
}
