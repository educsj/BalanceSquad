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

// Visual layer for one star slot: empty base + optional filled overlay
// (clipped to half the width when value lands on N - 0.5).
function StarGlyphs({ slot, value, size, w, h }: { slot: number; value: number; size: number; w: number; h: number }) {
  const isFull = value >= slot;
  const isHalf = !isFull && value >= slot - 0.5;
  return (
    <View style={{ width: w, height: h }} pointerEvents="none">
      <Text style={[styles.glyph, { fontSize: size, color: EMPTY, lineHeight: h }]}>★</Text>
      {(isFull || isHalf) && (
        <View style={[styles.fillOverlay, { width: isHalf ? w / 2 : w, height: h }]}>
          <Text style={[styles.glyph, { fontSize: size, color: FILLED, lineHeight: h }]}>★</Text>
        </View>
      )}
    </View>
  );
}

export default function StarRating({ value, onChange, readonly = false, size = 22 }: Props) {
  const w = size * GLYPH_WIDTH_RATIO;
  const h = size * 1.15;

  function handleTap(slot: number, half: boolean) {
    if (!onChange) return;
    onChange(half ? slot - 0.5 : slot);
  }

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(slot => {
        if (readonly) {
          return (
            <View key={slot} style={styles.slot}>
              <StarGlyphs slot={slot} value={value} size={size} w={w} h={h} />
            </View>
          );
        }
        // Touchable halves are the BASE layer (real layout box) so taps
        // register predictably on every platform. The star glyph sits on top
        // with pointerEvents="none" so it never swallows the touch.
        return (
          <View key={slot} style={[styles.slot, { width: w, height: h }]}>
            <View style={styles.tapRow}>
              <TouchableOpacity
                style={styles.tapHalf}
                onPress={() => handleTap(slot, true)}
                hitSlop={{ top: 8, bottom: 8, left: slot === 1 ? 8 : 0, right: 0 }}
                activeOpacity={0.5}
              />
              <TouchableOpacity
                style={styles.tapHalf}
                onPress={() => handleTap(slot, false)}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: slot === 5 ? 8 : 0 }}
                activeOpacity={0.5}
              />
            </View>
            <View style={styles.glyphOverlay} pointerEvents="none">
              <StarGlyphs slot={slot} value={value} size={size} w={w} h={h} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  slot: { position: 'relative' },
  tapRow: { flexDirection: 'row', flex: 1 },
  tapHalf: { flex: 1, height: '100%' },
  glyphOverlay: { ...StyleSheet.absoluteFillObject },
  glyph: { textAlign: 'left' },
  fillOverlay: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
});
