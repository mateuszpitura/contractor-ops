'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Check, Globe } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { localeConfigs } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { tDynLoose } from '@/i18n/typed-keys';
import { cn } from '@/lib/utils';

const localeFlagSrc: Record<Locale, string> = {
  pl: '/flags/pl.svg',
  en: '/flags/gb.svg',
  ar: '/flags/sa.svg',
  de: '/flags/de.svg',
};

const localeToKey: Record<Locale, string> = {
  pl: 'languagePolish',
  en: 'languageEnglish',
  ar: 'languageArabic',
  de: 'languageGerman',
};

export function LanguageCard() {
  const t = useTranslations('Settings');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    router.replace(pathname, { locale: newLocale });
  };

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
          {routing.locales.map(loc => {
            const config = localeConfigs[loc];
            const isActive = loc === locale;

            return (
              <button
                key={loc}
                type="button"
                lang={loc}
                dir={config.dir}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => handleLocaleChange(loc)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-all duration-200',
                  'hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive
                    ? 'border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-transparent',
                )}>
                {isActive && (
                  <span className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}

                <Image
                  src={localeFlagSrc[loc]}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />

                <span className="text-sm font-semibold leading-tight">{config.nativeName}</span>

                <span className="text-xs text-muted-foreground leading-tight">
                  {tDynLoose(t, 'fields', localeToKey[loc])}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
