import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: Props) {
  const logoScale = useRef(new Animated.Value(0.35)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, damping: 7, stiffness: 90, mass: 0.9, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(containerOpacity, { toValue: 0, duration: 380, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">
      <Animated.View style={[styles.logoBox, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
        <Text style={styles.ball}>⚽</Text>
        <Text style={styles.title}>Balance Squad</Text>
        <Text style={styles.sub}>By Eduardo Coutinho</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoBox: { alignItems: 'center', gap: 10 },
  ball: { fontSize: 72 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  sub: { color: '#93C5FD', fontSize: 14 },
});
