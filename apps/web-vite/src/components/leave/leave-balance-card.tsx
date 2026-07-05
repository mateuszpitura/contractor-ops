import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, TriangleAlert } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { minutesToDays } from './hooks/use-leave-queue.js';

interface LeaveBalanceCardProps {
  availableMinutes: number | null;
  requestedMinutes: number;
  remainingMinutes: number | null;
  isLoading?: boolean;
}

/**
 * Side-panel balance-after anchor. The remaining-days figure is the Display-size
 * focal element; a negative balance-after is surfaced with an icon + text (never
 * colour alone) and signals that the request cannot be submitted.
 */
export function LeaveBalanceCard({
  availableMinutes,
  requestedMinutes,
  remainingMinutes,
  isLoading,
}: LeaveBalanceCardProps) {
  const t = useTranslations('Leave.balance');

  if (isLoading || availableMinutes == null || remainingMinutes == null) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-wide text-muted-foreground">{t('title')}</p>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const insufficient = remainingMinutes < 0;
  const remainingDays = minutesToDays(remainingMinutes);
  const availableDays = minutesToDays(availableMinutes);
  const requestedDays = minutesToDays(requestedMinutes);

  return (
    <div className="space-y-2">
      <p className="text-[12px] uppercase tracking-wide text-muted-foreground">{t('afterTitle')}</p>
      <p
        className={`font-display text-[28px] font-semibold leading-[1.2] tabular-nums ${
          insufficient ? 'text-destructive' : 'text-primary'
        }`}>
        {t('remainingValue', { days: remainingDays })}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        {t('afterFormula', { available: availableDays, requested: requestedDays })}
      </p>
      {insufficient ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t('insufficient')}</span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t('remaining')}: {t('remainingValue', { days: availableDays })}
          </span>
        </p>
      )}
    </div>
  );
}
