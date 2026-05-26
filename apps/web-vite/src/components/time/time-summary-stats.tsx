/**
 * Time summary stats (3 cards). Step 11 codemod port from
 * apps/web/src/components/time/time-summary-stats.tsx:
 *   - `next-intl` → `../../i18n/useTranslations.js`
 *   - `@/components/portal/summary-card` → `../portal/summary-card.js`
 */

import { CheckCircle2, Clock, Send } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { SummaryCard, SummaryCardSkeleton } from '../portal/summary-card.js';

interface TimeSummaryStatsProps {
  currentWeekMinutes: number;
  pendingCount: number;
  approvedMonthMinutes: number;
  isLoading?: boolean;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function TimeSummaryStats({
  currentWeekMinutes,
  pendingCount,
  approvedMonthMinutes,
  isLoading,
}: TimeSummaryStatsProps) {
  const t = useTranslations('Time');
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SummaryCard
        icon={Clock}
        label={t('summaryStats.thisWeek')}
        value={formatHours(currentWeekMinutes)}
      />
      <SummaryCard icon={Send} label={t('summaryStats.pendingReview')} value={pendingCount} />
      <SummaryCard
        icon={CheckCircle2}
        label={t('summaryStats.approvedThisMonth')}
        value={formatHours(approvedMonthMinutes)}
      />
    </div>
  );
}
