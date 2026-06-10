/**
 * BoE rate poller status strip — presentational variants.
 *
 * Single-path renderers per variant. The container picks which one to
 * mount based on hook flags; views own no internal branching.
 */

import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useBoeRatePollerStatus } from '../hooks/use-admin-boe-rate.js';

export function PollerStatusStripEmpty() {
  const t = useTranslations('Admin.BoeRate');
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
      <XCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('pollerNoData')}</span>
    </div>
  );
}

interface PollerStatusStripActiveProps {
  pollDate: string;
  ratePercent: string;
  rateChanged: boolean;
}

export function PollerStatusStripActive({
  pollDate,
  ratePercent,
  rateChanged,
}: PollerStatusStripActiveProps) {
  const t = useTranslations('Admin.BoeRate');
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground"
      role="status"
      aria-label={t('ariaPollerStatus')}>
      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <span>
        {rateChanged
          ? t('pollerSuccess', { date: pollDate, percent: ratePercent })
          : t('pollerSuccessUnchanged', { date: pollDate })}
      </span>
    </div>
  );
}

export function PollerStatusStrip() {
  const { entries, apiEntries, latestApiEntry, rateChanged } = useBoeRatePollerStatus();

  if (!entries) return null;
  if (apiEntries.length === 0 || !latestApiEntry) return <PollerStatusStripEmpty />;

  return (
    <PollerStatusStripActive
      pollDate={new Date(latestApiEntry.createdAt).toISOString().slice(0, 10)}
      ratePercent={Number(latestApiEntry.ratePercent).toFixed(2)}
      rateChanged={rateChanged}
    />
  );
}
