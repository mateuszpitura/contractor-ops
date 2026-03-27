"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { useRouter } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ContractorTimesheetReview } from "@/components/time/contractor-timesheet-review";
import { Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Inner content
// ---------------------------------------------------------------------------

function ContractorReviewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const contractorId = params.contractorId as string;
  const week = searchParams.get("week");

  // First, find the timesheet for this contractor + week
  // We query all submitted timesheets for this contractor to find the right one
  const listQuery = useQuery({
    ...trpc.time.listAll.queryOptions({
      contractorId,
      ...(week ? { from: week, to: week } : {}),
      limit: 1,
    }),
  });

  const timesheetId = useMemo(() => {
    const data = listQuery.data as
      | { items: Array<{ id: string }> }
      | undefined;
    return data?.items?.[0]?.id;
  }, [listQuery.data]);

  // Fetch the full timesheet with entries
  const detailQuery = useQuery({
    ...trpc.time.getTimesheet.queryOptions({
      timesheetId: timesheetId ?? "",
    }),
    enabled: !!timesheetId,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [["time"]],
    });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.time.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Timesheet approved");
        invalidate();
        router.push("/time");
      },
      onError: () => toast.error("Failed to approve timesheet"),
    }),
  );

  const rejectMutation = useMutation(
    trpc.time.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Timesheet rejected");
        invalidate();
        router.push("/time");
      },
      onError: () => toast.error("Failed to reject timesheet"),
    }),
  );

  const handleApprove = useCallback(() => {
    if (!timesheetId) return;
    approveMutation.mutate({ timesheetId });
  }, [timesheetId, approveMutation]);

  const handleReject = useCallback(
    (reason: string) => {
      if (!timesheetId) return;
      rejectMutation.mutate({ timesheetId, reason });
    },
    [timesheetId, rejectMutation],
  );

  const handleBack = useCallback(() => {
    router.push("/time");
  }, [router]);

  if (listQuery.isLoading || (timesheetId && detailQuery.isLoading)) {
    return <ReviewSkeleton />;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timesheet = detailQuery.data as any;

  if (!timesheetId || !timesheet) {
    return (
      <EmptyState
        icon={Clock}
        heading="Timesheet not found"
        body="The requested timesheet could not be found. It may have been removed or the URL is incorrect."
        primaryAction={{ label: "Back to Time Tracking", href: "/time" }}
      />
    );
  }

  return (
    <ContractorTimesheetReview
      timesheet={timesheet}
      onApprove={handleApprove}
      onReject={handleReject}
      onBack={handleBack}
      isApproving={approveMutation.isPending}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <Skeleton className="ml-2 h-6 w-20" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Per-contractor timesheet review page at /time/[contractorId].
 * Reads week from search params to identify the specific timesheet.
 */
export default function ContractorTimesheetReviewPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ContractorReviewContent />
    </Suspense>
  );
}
