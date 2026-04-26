'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { Locale } from './config';
import type { TranslationMessages } from './get-translations';

interface TranslationContextValue {
  t: TranslationMessages;
  locale: Locale;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

/**
 * Provides translations to all child components via context.
 * Wraps the page content — set at the [locale] page level.
 */
export function TranslationProvider({
  children,
  translations,
  locale,
}: {
  children: ReactNode;
  translations: TranslationMessages;
  locale: Locale;
}) {
  return <TranslationContext value={{ t: translations, locale }}>{children}</TranslationContext>;
}

/**
 * Hook to access translations in any client component.
 * Must be inside a TranslationProvider.
 */
export function useTranslations(): TranslationMessages {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useTranslations must be used within TranslationProvider');
  }
  return ctx.t;
}

/**
 * Hook to access current locale.
 */
export function useLocale(): Locale {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useLocale must be used within TranslationProvider');
  }
  return ctx.locale;
}
