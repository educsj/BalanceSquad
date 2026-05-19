import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types';
import { createSession, getPeladaById } from '../storage';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'SessionCreate'>;
type Nav = StackNavigationProp<RootStackParamList>;

function pad(n: number): string { return String(n).padStart(2, '0'); }

function isoDateOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysIso(baseIso: string, n: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const out = new Date(y, m - 1, d);
  out.setDate(out.getDate() + n);
  return isoDateOf(out);
}

// Parses "DD/MM/AAAA" → "YYYY-MM-DD" or null if invalid.
function parseUserDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Validate via Date round-trip to catch Feb 30, etc.
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Pretty display for a YYYY-MM-DD as DD/MM/YYYY.
function displayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Optional HH:MM validation. Returns null if invalid OR empty.
function parseUserTime(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

export default function SessionCreateScreen() {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const todayIso = isoDateOf(new Date());
  const [dateInput, setDateInput] = useState<string>(displayDate(todayIso));
  const [timeInput, setTimeInput] = useState<string>('');
  const [maxPlayersInput, setMaxPlayersInput] = useState<string>('10');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Default max players = playersPerTeam * 2 (two teams worth). User can edit.
      getPeladaById(params.peladaId).then(p => {
        if (p) setMaxPlayersInput(String(p.playersPerTeam * 2));
      });
    }, [params.peladaId])
  );

  const parsedDate = parseUserDate(dateInput);
  const parsedTime = parseUserTime(timeInput); // null when empty too
  const timeEmpty = timeInput.trim() === '';
  const parsedMax = parseInt(maxPlayersInput, 10);
  const maxValid = Number.isFinite(parsedMax) && parsedMax > 0;
  const canSave = !!parsedDate && (timeEmpty || !!parsedTime) && maxValid && !saving;

  function applyPreset(daysFromToday: number) {
    setDateInput(displayDate(addDaysIso(todayIso, daysFromToday)));
  }

  async function handleSave() {
    if (!parsedDate || !maxValid) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const session = await createSession(params.peladaId, {
      date: parsedDate,
      time: parsedTime ?? undefined,
      maxPlayers: parsedMax,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    if (!session) {
      Alert.alert(t('sessions.createErrorTitle'), t('sessions.createErrorMsg'));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('sessions.dateLabel')}</Text>
        <TextInput
          style={[styles.input, !parsedDate && dateInput.length > 0 && styles.inputError]}
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          maxLength={10}
        />
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(0)} activeOpacity={0.8}>
            <Text style={styles.presetChipText}>{t('sessions.presetToday')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1)} activeOpacity={0.8}>
            <Text style={styles.presetChipText}>{t('sessions.presetTomorrow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7)} activeOpacity={0.8}>
            <Text style={styles.presetChipText}>{t('sessions.presetWeek')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('sessions.timeLabel')}</Text>
        <TextInput
          style={[styles.input, !timeEmpty && !parsedTime && styles.inputError]}
          value={timeInput}
          onChangeText={setTimeInput}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <Text style={styles.hint}>{t('sessions.timeHint')}</Text>

        <Text style={styles.label}>{t('sessions.maxPlayersLabel')}</Text>
        <TextInput
          style={[styles.input, !maxValid && styles.inputError]}
          value={maxPlayersInput}
          onChangeText={setMaxPlayersInput}
          keyboardType="numeric"
          maxLength={3}
        />
        <Text style={styles.hint}>{t('sessions.maxPlayersHint')}</Text>

        <Text style={styles.label}>{t('sessions.notesLabel')}</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('sessions.notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, !canSave && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          <Feather name="check" size={16} color="#fff" />
          <Text style={styles.btnPrimaryText}>{t('sessions.createCta')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 8 },
    label: { fontSize: 14, fontWeight: '700', color: c.text, marginTop: 14 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 15,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    inputError: { borderColor: c.danger },
    notesInput: { minHeight: 70, textAlignVertical: 'top' },
    hint: { fontSize: 11, color: c.textMuted, marginTop: -2 },

    presetRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    presetChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surfaceVariant,
    },
    presetChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },

    footer: {
      flexDirection: 'row',
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      backgroundColor: c.surface,
    },
    btnSecondary: {
      flex: 1,
      backgroundColor: c.borderLight,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnSecondaryText: { color: c.text, fontWeight: '600', fontSize: 15 },
    btnPrimary: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 14,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    btnDisabled: { backgroundColor: c.disabled },
  });
}
