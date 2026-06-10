import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from '../../i18n/navigation.js';
import { ProfileHeaderContainer } from './contractor-profile/profile-header.js';
import { ProfileTabs } from './contractor-profile/profile-tabs.js';
import { ActivityTimeline } from './contractor-profile/right-rail.js';
import { RightRail } from './contractor-profile/right-rail.js';
import { TabCompliance } from './contractor-profile/tab-compliance.js';
import { TabContractsContainer } from './contractor-profile/tab-contracts.js';
import { TabDocumentsSection } from './contractor-profile/tab-documents.js';
import { TabEquipment } from './contractor-profile/tab-equipment.js';
import { TabOverview } from './contractor-profile/tab-overview.js';
import { TabPaymentsContainer } from './contractor-profile/tab-payments.js';
import { InvoicesTabContainer } from './contractor-profile/tabs/invoices-tab.js';
import { WorkflowsTabContainer } from './contractor-profile/workflows-tab.js';
import { useContractorDetail } from './hooks/use-contractor-detail.js';

function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="size-7" />
      </div>
    </div>
  );
}

function TabContentSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`skel-${i}`} className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContractorDetailContainer() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id ?? '';
  const { contractor, t, handleRetry, isNotFound, isError, isLoading } =
    useContractorDetail(contractorId);

  if (isError) {
    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t('error.notFound')}</h2>
          <Button variant="outline" render={<Link href="/contractors" />}>
            {t('error.backToList')}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('error.loadFailed')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-section-gap">
      {isLoading || !contractor ? (
        <ProfileHeaderSkeleton />
      ) : (
        <ProfileHeaderContainer contractor={contractor} />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {isLoading || !contractor ? (
            <>
              <div className="mb-4 flex gap-2 border-b pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={`tab-skel-${i}`} className="h-7 w-20" />
                ))}
              </div>
              <TabContentSkeleton />
            </>
          ) : (
            <Suspense fallback={<TabContentSkeleton />}>
              <ProfileTabs
                overviewContent={<TabOverview contractor={contractor} />}
                complianceContent={<TabCompliance contractor={contractor} />}
                contractsContent={<TabContractsContainer contractorId={contractorId} />}
                documentsContent={<TabDocumentsSection contractorId={contractorId} />}
                workflowsContent={<WorkflowsTabContainer contractorId={contractorId} />}
                invoicesContent={<InvoicesTabContainer contractorId={contractorId} />}
                paymentsContent={<TabPaymentsContainer contractorId={contractorId} />}
                equipmentContent={<TabEquipment contractorId={contractorId} />}
                activityContent={
                  <ActivityTimeline
                    createdAt={String(contractor.createdAt)}
                    updatedAt={String(contractor.updatedAt)}
                    lifecycleStage={contractor.lifecycleStage}
                  />
                }
              />
            </Suspense>
          )}
        </div>

        <div className="w-full lg:w-[280px] lg:shrink-0">
          {isLoading || !contractor ? (
            <div className="space-y-4 rounded-xl border bg-card p-4">
              <Skeleton className="h-5 w-20" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : (
            <RightRail contractor={contractor} />
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ContractorDetail */
export { ContractorDetailContainer as ContractorDetail };
