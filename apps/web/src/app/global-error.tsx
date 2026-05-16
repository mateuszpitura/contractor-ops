'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div>
          <h2>{t('serverError.heading')}</h2>
          <button type="button" onClick={reset}>
            {t('serverError.cta')}
          </button>
        </div>
      </body>
    </html>
  );
}
