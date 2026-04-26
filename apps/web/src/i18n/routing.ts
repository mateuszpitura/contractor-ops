import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'pl', 'ar', 'de'] as const,
  defaultLocale: 'pl',
});

export type Locale = (typeof routing.locales)[number];
