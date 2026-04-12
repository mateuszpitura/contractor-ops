'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * 500 Error page.
 * Client component with reset capability.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors.serverError');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <div className="space-y-4">
        <p className="font-display text-6xl font-bold text-muted-foreground/20">{t('code')}</p>
        <h1 className="font-display text-[22px] font-semibold">{t('heading')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('body')}</p>
        <Button onClick={reset} className="mt-4">
          {t('cta')}
        </Button>
      </div>
    </div>
  );
}
