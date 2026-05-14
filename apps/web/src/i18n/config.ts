import type { Locale } from './routing';

export interface LocaleConfig {
  /** Display name in that language */
  nativeName: string;
  /** Display name in English (for admin/dev) */
  englishName: string;
  /** Text direction */
  dir: 'ltr' | 'rtl';
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
  },
  pl: {
    nativeName: 'Polski',
    englishName: 'Polish',
    dir: 'ltr',
  },
  ar: {
    nativeName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629',
    englishName: 'Arabic',
    dir: 'rtl',
  },
  de: {
    nativeName: 'Deutsch',
    englishName: 'German',
    dir: 'ltr',
  },
};

export function isRtl(locale: Locale): boolean {
  return localeConfigs[locale].dir === 'rtl';
}

export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return localeConfigs[locale].dir;
}
