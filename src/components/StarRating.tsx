import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StarLevel } from '../types';

interface Props {
  value: StarLevel;
  onChange?: (level: StarLevel) => void;
  readonly?: boolean;
  size?: number;
}

const FILLED = '#F5C518';
const EMPTY = '#CBD5E1';
const GLYPH_WIDTH_RATIO = 0.95;

// One star slot: empty base + a clipped filled overlay (full or half width).
function Star({ slot, value, size }: { slot: number; value: number; size: number }) {
  const isFull = value >= slot;
  const isHalf = !isFull && value >= slot - 0.5;
  const w = size * GLYPH_WIDTH_RATIO;
  const h = size * 1.15;

  return (
    <View style={{ width: w, height: h }}>
      <Text style={[styles.glyph, { fontSize: size, color: EMPTY, lineHeight: h }]}>★</Text>
      {(isFull || isHalf) && (
        <View
          style={[
            styles.overlay,
            { width: isHalf ? w / 2 : w, height: h },
          ]}
        >
          <Text style={[styles.glyph, { fontSize: size, color: FILLED, lineHeight: h }]}>★</Text>
        </View>
      )}
    </View>
  );
}

export default function StarRating({ value, onChange, readonly = false, size = 22 }: Props) {
  function handleTap(slot: number, half: boolean) {
    if (!onChange) return;
    onChange(half ? slot - 0.5 : slot);
  }

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(slot => (
        <View key={slot} style={styles.slot}>
          <Star slot={slot} value={value} size={size} />
          {!readonly && (
            <View style={styles.touchOverlay}>
              <TouchableOpacity
                style={styles.touchHalf}
                onPress={() => handleTap(slot, true)}
                activeOpacity={0.6}
              />
              <TouchableOpacity
                style={styles.touchHalf}
                onPress={() => handleTap(slot, false)}
                activeOpacity={0.6}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  slot: { position: 'relative' },
  glyph: { textAlign: 'left' },
  overlay: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  touchOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  touchHalf: { flex: 1 },
});
