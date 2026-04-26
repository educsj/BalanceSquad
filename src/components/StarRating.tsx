import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StarLevel } from '../types';

interface Props {
  value: StarLevel;
  onChange?: (level: StarLevel) => void;
  readonly?: boolean;
  size?: number;
}

export default function StarRating({ value, onChange, readonly = false, size = 22 }: Props) {
  return (
    <View style={styles.row}>
      {([1, 2, 3, 4, 5] as StarLevel[]).map(star => (
        <TouchableOpacity
          key={star}
          disabled={readonly}
          onPress={() => onChange?.(star)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: size, color: star <= value ? '#F5C518' : '#CBD5E1' }}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
