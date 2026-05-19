import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getThemeMode, ThemeMode } from '../storage';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  headerBg: string;
  headerText: string;
  headerSub: string;
  headerBtnBg: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  disabled: string;
  disabledText: string;
  badgeBg: string;
  badgeText: string;
  danger: string;
  genderTintMale: string;
  genderTintFemale: string;
  teamColors: readonly string[];
};

export const lightColors: ThemeColors = {
  background: '#F0F4FF',
  surface: '#FFFFFF',
  surfaceVariant: '#F8FAFC',
  primary: '#1E3A5F',
  primaryLight: '#EEF2FF',
  secondary: '#64748B',
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  text: '#1E3A5F',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  headerBg: '#1E3A5F',
  headerText: '#FFFFFF',
  headerSub: '#93C5FD',
  headerBtnBg: 'rgba(255,255,255,0.12)',
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  inputText: '#1E3A5F',
  disabled: '#CBD5E1',
  disabledText: '#94A3B8',
  badgeBg: '#DBEAFE',
  badgeText: '#1E3A5F',
  danger: '#B91C1C',
  genderTintMale: 'rgba(59, 130, 246, 0.14)',
  genderTintFemale: 'rgba(236, 72, 153, 0.14)',
  teamColors: ['#1E3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B91C1C'],
};

export const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#263449',
  primary: '#60A5FA',
  primaryLight: '#1E3A5F',
  secondary: '#94A3B8',
  border: '#334155',
  borderLight: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  headerBg: '#0F172A',
  headerText: '#F1F5F9',
  headerSub: '#60A5FA',
  headerBtnBg: 'rgba(255,255,255,0.08)',
  inputBg: '#1E293B',
  inputBorder: '#334155',
  inputText: '#F1F5F9',
  disabled: '#334155',
  disabledText: '#475569',
  badgeBg: '#1E3A5F',
  badgeText: '#93C5FD',
  danger: '#F87171',
  genderTintMale: 'rgba(96, 165, 250, 0.22)',
  genderTintFemale: 'rgba(244, 114, 182, 0.22)',
  teamColors: ['#60A5FA', '#93C5FD', '#2DD4BF', '#A78BFA', '#F87171'],
};

type Theme = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<Theme>({
  colors: lightColors,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getThemeMode().then(setModeState);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const value = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      mode,
      setMode: setModeState,
    }),
    [isDark, mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
