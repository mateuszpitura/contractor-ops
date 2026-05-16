'use client';

import { CheckCircle2, Clock, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SummaryCard, SummaryCardSkeleton } from '@/components/portal/summary-card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeSummaryStatsProps {
  currentWeekMinutes: number;
  pendingCount: number;
  approvedMonthMinutes: number;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 3 summary cards for portal time page per UI-SPEC TimeSummaryStats:
 * - "This Week": total hours logged this week
 * - "Pending Review": count of submitted timesheets
 * - "Approved This Month": total approved hours this month
 */
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
