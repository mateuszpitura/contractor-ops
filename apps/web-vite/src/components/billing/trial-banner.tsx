import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { X, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface TrialBannerProps {
  trialEnd: Date;
  onUpgrade: () => void;
}

export function TrialBanner({ trialEnd, onUpgrade }: TrialBannerProps) {
  const t = useTranslations('Billing.trial');
  const [dismissed, setDismissed] = useState(false);

  const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (daysRemaining <= 0 || daysRemaining > 7 || dismissed) {
    return null;
  }

  const message = getTrialMessage(t, daysRemaining);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative w-full border-s-4 border-warning bg-warning/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onUpgrade}>
            <Zap className="me-1.5 size-4" />
            {t('choosePlan')}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('dismissAria')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getTrialMessage(t: ReturnType<typeof useTranslations>, daysRemaining: number): string {
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
