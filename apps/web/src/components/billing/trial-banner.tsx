'use client';

import { X, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialBannerProps {
  trialEnd: Date;
  onUpgrade: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrialBanner({ trialEnd, onUpgrade }: TrialBannerProps) {
  const t = useTranslations('Billing.trial');
  const [dismissed, setDismissed] = useState(false);

  const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Only render during last 7 days of trial, and only if not expired
  if (daysRemaining <= 0 || daysRemaining > 7 || dismissed) {
    return null;
  }

  const message = getTrialMessage(t, daysRemaining);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative w-full border-l-4 border-warning bg-warning/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onUpgrade}>
            <Zap className="me-1.5 size-4" />
            {t('choosePlan')}
          </Button>
          <button
            type="button"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('dismissAria')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrialMessage(
  t: ReturnType<typeof useTranslations<'Billing.trial'>>,
  daysRemaining: number,
): string {
  switch (daysRemaining) {
    case 7:
      return t('ends7Days');
    case 3:
      return t('ends3Days');
    case 1:
      return t('ends1Day');
    default:
      return t('endsInDays', { days: daysRemaining });
  }
}
