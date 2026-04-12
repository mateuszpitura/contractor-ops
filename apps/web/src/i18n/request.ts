import { getRequestConfig } from 'next-intl/server';
import type { Locale } from './routing';
import { routing } from './routing';

const localeSettings: Record<
  Locale,
  { timeZone: string; currency: string; numberingSystem?: string }
> = {
  en: { timeZone: 'Europe/Warsaw', currency: 'EUR' },
  pl: { timeZone: 'Europe/Warsaw', currency: 'PLN' },
  ar: { timeZone: 'Asia/Dubai', currency: 'AED', numberingSystem: 'latn' },
  de: { timeZone: 'Europe/Berlin', currency: 'EUR' },
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!(locale && routing.locales.includes(locale as Locale))) {
    locale = routing.defaultLocale;
  }

  const settings = localeSettings[locale as Locale] ?? localeSettings.en;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: settings.timeZone,
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      },
      number: {
        currency: { style: 'currency', currency: settings.currency },
        percent: { style: 'percent' },
      },
    },
    ...(settings.numberingSystem && {
      onError(error) {
        // Silently ignore — next-intl logs by default
        console.error(error);
      },
    }),
  };
});
