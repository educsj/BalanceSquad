import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Player, StarLevel, Gender, RootStackParamList } from '../types';
import { getPeladaById, updatePelada } from '../storage';
import StarRating from '../components/StarRating';
import { formatStars, clampLevel } from '../utils/stars';
import { useTheme, ThemeColors } from '../theme';

type RouteProps = RouteProp<RootStackParamList, 'PlayerRegister'>;
type Nav = StackNavigationProp<RootStackParamList>;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const GENDER_OPTIONS: { value: Gender | undefined; key: string }[] = [
  { value: undefined, key: 'none' },
  { value: 'M', key: 'male' },
  { value: 'F', key: 'female' },
];

export default function PlayerRegisterScreen() {
  const { params } = useRoute<RouteProps>();
  const { peladaId, editPlayerId } = params;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEditing = !!editPlayerId;

  const [name, setName] = useState('');
  const [level, setLevel] = useState<StarLevel>(3);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [playerCount, setPlayerCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getPeladaById(peladaId).then(pelada => {
        if (!pelada) return;
        setPlayerCount(pelada.players.length);
        if (editPlayerId) {
          const player = pelada.players.find(p => p.id === editPlayerId);
          if (player) {
            setName(player.name);
            setLevel(player.level);
            setGender(player.gender);
          }
        }
      });
    }, [peladaId, editPlayerId])
  );

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pelada = await getPeladaById(peladaId);
    if (!pelada) return;

    let updatedPlayers: Player[];
    if (isEditing && editPlayerId) {
      updatedPlayers = pelada.players.map(p =>
        p.id === editPlayerId ? { ...p, name: trimmed, level, gender } : p
      );
    } else {
      updatedPlayers = [...pelada.players, { id: generateId(), name: trimmed, level, gender }];
    }

    await updatePelada({ ...pelada, players: updatedPlayers });
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {!isEditing && (
          <Text style={styles.counter}>
            {t('playerRegister.playersCount', { count: playerCount })}
          </Text>
        )}

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('playerRegister.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('playerRegister.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('playerRegister.levelLabel')}</Text>
            <View style={styles.levelRow}>
              <StarRating value={level} onChange={setLevel} size={34} />
              <Text style={styles.levelValue}>{formatStars(level)} ★</Text>
            </View>
            <View style={styles.halfBtnRow}>
              <TouchableOpacity
                style={[styles.halfBtn, level <= 0.5 && styles.halfBtnDisabled]}
                onPress={() => setLevel(clampLevel(level - 0.5))}
                disabled={level <= 0.5}
              >
                <Feather name="minus" size={14} color={colors.primary} />
                <Text style={styles.halfBtnText}>½</Text>
              </TouchableOpacity>
              <Text style={styles.halfHint}>{t('playerRegister.halfStarHint')}</Text>
              <TouchableOpacity
                style={[styles.halfBtn, level >= 5 && styles.halfBtnDisabled]}
                onPress={() => setLevel(clampLevel(level + 0.5))}
                disabled={level >= 5}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={styles.halfBtnText}>½</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('playerRegister.genderLabel')}</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(opt => {
                const active = gender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.genderBtn, active && styles.genderBtnActive]}
                    onPress={() => setGender(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderBtnText, active && styles.genderBtnTextActive]}>
                      {t(`playerRegister.gender.${opt.key}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim()}
        >
          <Text style={styles.saveBtnText}>
            {isEditing ? t('playerRegister.saveChanges') : t('playerRegister.addPlayer')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.background, padding: 20 },
    counter: { color: c.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 16 },
    form: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 20,
      gap: 20,
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      marginBottom: 24,
    },
    fieldGroup: { gap: 8 },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 13,
      fontSize: 16,
      color: c.inputText,
      backgroundColor: c.inputBg,
    },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    levelValue: { fontSize: 16, fontWeight: '700', color: c.text },
    halfBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    halfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceVariant,
    },
    halfBtnDisabled: { opacity: 0.4 },
    halfBtnText: { color: c.primary, fontWeight: '800', fontSize: 14 },
    halfHint: { flex: 1, fontSize: 11, color: c.textSecondary, textAlign: 'center' },
    genderRow: { flexDirection: 'row', gap: 8 },
    genderBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      backgroundColor: c.surfaceVariant,
    },
    genderBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    genderBtnText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    genderBtnTextActive: { color: c.primary, fontWeight: '700' },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      elevation: 4,
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    saveBtnDisabled: { backgroundColor: c.disabled, elevation: 0, shadowOpacity: 0 },
    saveBtnText: { color: c.textOnPrimary, fontWeight: '700', fontSize: 16 },
  });
}
