/**
 * Language / locale picker.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Image } from '@unpic/react';
import { Check, Globe } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../../i18n/messages.js';
import { localeMeta, SUPPORTED_LOCALES } from '../../i18n/messages.js';
import { localePath, useLocale, usePathname } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';

const localeFlagSrc: Record<Locale, string> = {
  pl: '/flags/pl.svg',
  en: '/flags/gb.svg',
  ar: '/flags/sa.svg',
  de: '/flags/de.svg',
  'en-US': '/flags/us.svg',
};

const localeToKey: Record<Locale, string> = {
  pl: 'languagePolish',
  en: 'languageEnglish',
  ar: 'languageArabic',
  de: 'languageGerman',
  'en-US': 'languageEnglishUs',
};

function LocaleButton({
  loc,
  isActive,
  label,
  onSelect,
}: {
  loc: Locale;
  isActive: boolean;
  label: string;
  onSelect: (loc: Locale) => void;
}) {
  const config = localeMeta[loc];
  const handleClick = useCallback(() => onSelect(loc), [onSelect, loc]);
  return (
    <button
      key={loc}
      type="button"
      lang={loc}
      dir={config.dir}
      onClick={handleClick}
      className={cn(
        'group relative flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-all duration-200',
        'hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        isActive
          ? 'border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-transparent',
      )}>
      {isActive ? (
        <span className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}

      <Image src={localeFlagSrc[loc]} alt="" width={28} height={28} className="rounded-full" />

      <span className="text-sm font-semibold leading-tight">{config.nativeName}</span>

      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </button>
  );
}

export function LanguageCard() {
  const t = useTranslations('Settings');
  const locale = useLocale() as Locale;
  const navigate = useNavigate();
  const pathname = usePathname();

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      if (newLocale === locale) return;
      void navigate(localePath(pathname, newLocale), { replace: true });
    },
    [locale, navigate, pathname],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {t('appearance.heading')}
        </CardTitle>
        <CardDescription>{t('appearance.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUPPORTED_LOCALES.map((loc: Locale) => (
            <LocaleButton
              key={loc}
              loc={loc}
              isActive={loc === locale}
              label={tDynLoose(t, 'fields', localeToKey[loc])}
              onSelect={handleLocaleChange}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
