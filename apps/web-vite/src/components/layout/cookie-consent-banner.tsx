/**
 * Cookie-consent banner — pure presentational shell. Visibility is decided
 * by `CookieConsentBannerContainer`; this component renders only when
 * mounted.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';

interface CookieConsentBannerProps {
  onAccept: () => void;
}

export function CookieConsentBanner({ onAccept }: CookieConsentBannerProps) {
  const t = useTranslations('CookieConsent');
  const tCommon = useTranslations('Common');

  return (
    <div
      role="dialog"
      aria-label={tCommon('aria.cookieConsent')}
      className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4">
        <Cookie className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
        <p className="flex-1 text-sm text-muted-foreground">
          {t('message')}{' '}
          <Link
            to="legal/privacy"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            {t('learnMore')}
          </Link>
        </p>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button size="sm" onClick={onAccept} className="shrink-0">
          {t('accept')}
        </Button>
      </div>
    </div>
  );
}
