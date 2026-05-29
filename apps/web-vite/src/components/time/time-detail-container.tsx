/**
 * Per-contractor timesheet review — Step 10 batch 6 full port from
 * apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:
 *   - next-intl / @/trpc/init → useTranslations + useTRPC()
 *   - @/i18n/navigation → ../../i18n/navigation.js
 *   - next/navigation searchParams → react-router useSearchParams
 */

import { AtelierEmptyState, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowLeft } from 'lucide-react';
import { Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { ContractorTimesheetReview } from './contractor-timesheet-review.js';
import { useTimeDetail } from './hooks/use-time-detail.js';

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
          <Skeleton className="ms-2 h-6 w-20" />
        </div>
        <div className="text-end">
          <Skeleton className="ms-auto h-8 w-16" />
          <Skeleton className="mt-1 ms-auto h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div
        aria-hidden="true"
        className="sticky bottom-0 z-40 -mx-1 border-t bg-background px-1 py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContractorReviewContent() {
  const t = useTranslations('Time');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');
  const params = useParams<{ contractorId: string }>();
  const [searchParams] = useSearchParams();
  const contractorId = params.contractorId ?? '';
  const week = searchParams.get('week');

  const {
    listQuery,
    detailQuery,
    timesheetId,
    timesheet,
    handleApprove,
    handleReject,
    handleBack,
    isApproving,
    isRejecting,
  } = useTimeDetail(contractorId, week);

  const handleRetry = useCallback(() => {
    void listQuery.refetch();
    if (timesheetId) void detailQuery.refetch();
  }, [listQuery, detailQuery, timesheetId]);

  if (listQuery.isError || detailQuery.isError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{tCommon('networkError')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {tProfile('error.retry')}
        </Button>
      </div>
    );
  }

  if (listQuery.isLoading || (timesheetId && detailQuery.isLoading)) {
    return <ReviewSkeleton />;
  }

  if (!(timesheetId && timesheet)) {
    return (
      <AtelierEmptyState
        illustration={TimeTrackingIllustration}
        heading={t('detail.notFoundHeading')}
        body={t('detail.notFoundBody')}
        primaryAction={{ label: t('detail.backToTimeTracking'), href: '/time', icon: ArrowLeft }}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <ContractorTimesheetReview
      timesheet={timesheet}
      onApprove={handleApprove}
      onReject={handleReject}
      onBack={handleBack}
      isApproving={isApproving}
      isRejecting={isRejecting}
    />
  );
}

export function TimeDetailContainer() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ContractorReviewContent />
    </Suspense>
  );
}
