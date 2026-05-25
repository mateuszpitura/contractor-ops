/**
 * BoE rate poller status strip. Step 10 batch port from
 * apps/web/src/components/admin/boe-rate/poller-status-strip.tsx
 */

import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useBoeRatePollerStatus } from '../hooks/use-admin-boe-rate.js';

interface PollerStatusStripProps {
  poller: ReturnType<typeof useBoeRatePollerStatus>;
}

export function PollerStatusStrip({ poller }: PollerStatusStripProps) {
  const t = useTranslations('Admin.BoeRate');
  const { entries, apiEntries, latestApiEntry, rateChanged } = poller;

  if (!entries) {
    return null;
  }

  if (apiEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
        <XCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('pollerNoData')}</span>
      </div>
    );
  }

  const pollDate = new Date(latestApiEntry!.createdAt).toISOString().slice(0, 10);
  const rate = Number(latestApiEntry!.ratePercent).toFixed(2);

  return (
    <div
      className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground"
      role="status"
      aria-label={t('ariaPollerStatus')}>
      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <span>
        {rateChanged
          ? t('pollerSuccess', { date: pollDate, percent: rate })
          : t('pollerSuccessUnchanged', { date: pollDate })}
      </span>
    </div>
  );
}
