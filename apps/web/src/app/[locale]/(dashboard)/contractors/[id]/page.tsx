"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { ProfileHeader } from "@/components/contractors/contractor-profile/profile-header";
import { ProfileTabs } from "@/components/contractors/contractor-profile/profile-tabs";
import {
  ActivityTimeline,
  RightRail,
} from "@/components/contractors/contractor-profile/right-rail";
import { TabCompliance } from "@/components/contractors/contractor-profile/tab-compliance";
import { TabContracts } from "@/components/contractors/contractor-profile/tab-contracts";
import { TabDocuments } from "@/components/contractors/contractor-profile/tab-documents";
import { TabEquipment } from "@/components/contractors/contractor-profile/tab-equipment";
import { TabOverview } from "@/components/contractors/contractor-profile/tab-overview";
import { TabPayments } from "@/components/contractors/contractor-profile/tab-payments";
import { InvoicesTab } from "@/components/contractors/contractor-profile/tabs/invoices-tab";
import { WorkflowsTab } from "@/components/contractors/contractor-profile/workflows-tab";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";

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
        <div key={i} className="rounded-xl border bg-card p-4">
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

export default function ContractorProfilePage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("ContractorProfile");

  const contractorQuery = useQuery(trpc.contractor.getById.queryOptions({ id: params.id }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractor = contractorQuery.data as any;

  // Set breadcrumb label for this detail page
  useBreadcrumbOverride(params.id, contractor?.displayName);

  // Error state
  if (contractorQuery.isError) {
    const isNotFound =
      contractorQuery.error?.message?.includes("not found") ||
      (contractorQuery.error as { data?: { code?: string } })?.data?.code === "NOT_FOUND";

    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t("error.notFound")}</h2>
          <Button variant="outline" render={<Link href="/contractors" />}>
            {t("error.backToList")}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t("error.loadFailed")}</h2>
        <Button variant="outline" onClick={() => contractorQuery.refetch()}>
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {contractorQuery.isLoading || !contractor ? (
        <ProfileHeaderSkeleton />
      ) : (
        <ProfileHeader contractor={contractor} />
      )}

      {/* Main content area: tabs + right rail */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {contractorQuery.isLoading || !contractor ? (
            <>
              {/* Tab bar skeleton */}
              <div className="mb-4 flex gap-2 border-b pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-20" />
                ))}
              </div>
              <TabContentSkeleton />
            </>
          ) : (
            <Suspense fallback={<TabContentSkeleton />}>
              <ProfileTabs
                overviewContent={<TabOverview contractor={contractor} />}
                complianceContent={<TabCompliance contractor={contractor} />}
                contractsContent={<TabContracts contractorId={params.id} />}
                documentsContent={<TabDocuments contractorId={params.id} />}
                workflowsContent={<WorkflowsTab contractorId={params.id} />}
                invoicesContent={<InvoicesTab contractorId={params.id} />}
                paymentsContent={<TabPayments contractorId={params.id} />}
                equipmentContent={<TabEquipment contractorId={params.id} />}
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

        {/* Right rail */}
        <div className="w-full lg:w-[280px] lg:shrink-0">
          {contractorQuery.isLoading || !contractor ? (
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
