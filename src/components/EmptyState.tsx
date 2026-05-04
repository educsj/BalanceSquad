import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../theme';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name={icon} size={36} color={colors.headerSub} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      marginTop: 60,
      paddingHorizontal: 32,
      gap: 10,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    btn: {
      marginTop: 8,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    btnText: {
      color: c.textOnPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
