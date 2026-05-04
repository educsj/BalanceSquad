import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import pt from '../locales/pt.json';
import en from '../locales/en.json';
import es from '../locales/es.json';

export type SupportedLanguage = 'pt' | 'en' | 'es';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export function getDeviceLanguage(): SupportedLanguage {
  const locale = getLocales()[0]?.languageCode ?? 'pt';
  if (locale.startsWith('pt')) return 'pt';
  if (locale.startsWith('es')) return 'es';
  return 'en';
}

export async function initI18n(savedLanguage?: string | null): Promise<void> {
  if (i18n.isInitialized) return;
  const lng = (savedLanguage as SupportedLanguage) ?? getDeviceLanguage();
  await i18n.use(initReactI18next).init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es },
    },
    lng,
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export default i18n;
