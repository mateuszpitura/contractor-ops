"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Inbox, Upload, Mail } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";

import { InvoiceDetailLayout } from "@/components/invoices/invoice-detail/invoice-detail-layout";
import { InvoiceMetadataForm } from "@/components/invoices/invoice-detail/invoice-metadata-form";
import { MatchCard } from "@/components/invoices/invoice-detail/match-card";
import { DuplicateWarning } from "@/components/invoices/invoice-detail/duplicate-warning";
import { KsefMetadataSection } from "@/components/invoices/ksef-metadata-section";
import { KsefDuplicateBanner } from "@/components/invoices/ksef-duplicate-banner";
import { KsefSourceBadge } from "@/components/invoices/ksef-badge";
import { ChainTracker } from "@/components/approvals/chain-tracker";
import { AuditTimeline } from "@/components/approvals/audit-timeline";

// ---------------------------------------------------------------------------
// Status badge config (reuse from columns.tsx pattern)
// ---------------------------------------------------------------------------

const statusBadgeConfig: Record<
  string,
  { className: string; label: string }
> = {
  RECEIVED: { className: "bg-muted text-muted-foreground", label: "RECEIVED" },
  UNDER_REVIEW: {
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "UNDER_REVIEW",
  },
  MATCHED: {
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "MATCHED",
  },
  UNMATCHED: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "UNMATCHED",
  },
  DISCREPANCY: {
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
    label: "DISCREPANCY",
  },
  APPROVAL_PENDING: {
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "APPROVAL_PENDING",
  },
  APPROVED: {
    className: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "APPROVED",
  },
  REJECTED: {
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
    label: "REJECTED",
  },
  READY_FOR_PAYMENT: {
    className: "bg-primary/10 text-primary",
    label: "READY_FOR_PAYMENT",
  },
  PAID: { className: "bg-muted text-muted-foreground", label: "PAID" },
  VOID: { className: "bg-muted text-muted-foreground", label: "VOID" },
};

const sourceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MANUAL_UPLOAD: Upload,
  EMAIL_INTAKE: Mail,
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-0 lg:gap-8">
      {/* PDF placeholder */}
      <Skeleton className="h-[300px] lg:h-[calc(100vh-64px)] rounded-lg" />

      {/* Right panel skeleton */}
      <div className="space-y-6 py-4 lg:py-0">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-[240px]" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Match card skeleton */}
        <Skeleton className="h-32 rounded-lg" />

        {/* Form fields skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("Invoices");
  const queryClient = useQueryClient();

  // Fetch invoice data
  const invoiceQuery = useQuery(
    trpc.invoice.getById.queryOptions({ id: params.id })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice = invoiceQuery.data as any;

  useBreadcrumbOverride(params.id, invoice?.invoiceNumber);

  // Fetch PDF download URL for the first SOURCE_ORIGINAL file
  const sourceFile = invoice?.files?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.role === "SOURCE_ORIGINAL"
  );
  const documentId = sourceFile?.document?.id ?? sourceFile?.documentId;

  const pdfUrlQuery = useQuery({
    ...trpc.document.getDownloadUrl.queryOptions({
      documentId: documentId ?? "",
    }),
    enabled: !!documentId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfUrl = (pdfUrlQuery.data as any)?.url ?? null;

  // Submit for approval mutation
  const submitForApproval = useMutation(
    trpc.approval.submitForApproval.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: params.id }),
        });
        toast.success(t("detail.submittedForApprovalToast"));
      },
      onError: () => {
        toast.error(t("detail.submitForApprovalError"));
      },
    }),
  );

  // Loading state
  if (invoiceQuery.isLoading) {
    return (
      <div className="space-y-6">
        <DetailSkeleton />
      </div>
    );
  }

  // Error state
  if (invoiceQuery.isError || !invoice) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t("detail.loadError")}</h2>
        <Button variant="outline" onClick={() => invoiceQuery.refetch()}>
          {t("detail.retry")}
        </Button>
      </div>
    );
  }

  const statusConfig = statusBadgeConfig[invoice.status];
  const SourceIcon = sourceIconMap[invoice.source] ?? Inbox;

  // Check for duplicate flag
  const flags: string[] = Array.isArray(invoice.flagsJson)
    ? invoice.flagsJson
    : [];
  const hasDuplicateFlag = flags.includes("DUPLICATE_SUSPECTED");

  // Get duplicate invoice ID from latest match result
  const latestMatchResult = invoice.matchResults?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const explanationJson = latestMatchResult?.explanationJson as any;
  const duplicateInvoiceId = explanationJson?.duplicateInvoiceId ?? null;

  // KSeF metadata detection
  const isKsefSource = invoice.source === "KSEF";
  const ksefReference = invoice.externalInvoiceId as string | null;
  const ksefUpoReceipt = invoice.sourceReference as string | null;

  // KSeF duplicate detection (manual invoice with KSeF duplicate)
  const flagsObj =
    typeof invoice.flagsJson === "object" &&
    invoice.flagsJson !== null &&
    !Array.isArray(invoice.flagsJson)
      ? (invoice.flagsJson as Record<string, unknown>)
      : null;
  const hasKsefDuplicate = flagsObj?.duplicateSource === "KSEF";
  const ksefDuplicateId = (flagsObj?.duplicateOf as string) ?? null;

  // Approval visibility conditions
  const hasApprovalFlow =
    invoice.status === "APPROVAL_PENDING" ||
    invoice.status === "APPROVED" ||
    invoice.status === "REJECTED";

  const canSubmitForApproval =
    (invoice.matchStatus === "MATCHED" ||
      invoice.matchStatus === "MANUALLY_CONFIRMED") &&
    invoice.status !== "APPROVAL_PENDING" &&
    invoice.status !== "APPROVED" &&
    invoice.status !== "REJECTED" &&
    invoice.status !== "READY_FOR_PAYMENT" &&
    invoice.status !== "PAID";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold font-mono">
          {invoice.invoiceNumber}
        </h1>
        {statusConfig && (
          <Badge
            variant="secondary"
            className={`gap-1 ${statusConfig.className}`}
          >
            {t(`status.${statusConfig.label}`)}
          </Badge>
        )}
        {isKsefSource ? (
          <KsefSourceBadge fetchedAt={invoice.receivedAt} />
        ) : (
          <SourceIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Side-by-side layout */}
      <InvoiceDetailLayout pdfUrl={pdfUrl}>
        {/* KSeF duplicate banner (manual invoice with KSeF duplicate) */}
        {hasKsefDuplicate && ksefDuplicateId && (
          <KsefDuplicateBanner
            duplicateInvoiceId={ksefDuplicateId}
            invoiceNumber={invoice.invoiceNumber}
            sellerNip={invoice.sellerTaxId ?? ""}
          />
        )}

        {/* Standard duplicate warning (conditional) */}
        {hasDuplicateFlag && (
          <DuplicateWarning
            invoiceId={invoice.id}
            duplicateInvoiceId={duplicateInvoiceId}
            invoiceNumber={invoice.invoiceNumber}
            onDismiss={() => {
              queryClient.invalidateQueries({
                queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
              });
            }}
          />
        )}

        {/* KSeF metadata section (KSeF-sourced invoices) */}
        {isKsefSource && ksefReference && (
          <KsefMetadataSection
            ksefReference={ksefReference}
            upoReceipt={ksefUpoReceipt}
            fetchedAt={invoice.receivedAt ?? invoice.createdAt}
            source={invoice.source}
          />
        )}

        {/* Match card */}
        <MatchCard
          invoice={invoice}
          onMatchConfirmed={() => {
            queryClient.invalidateQueries({
              queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
            });
          }}
        />

        {/* Submit for approval button */}
        {canSubmitForApproval && (
          <div className="flex justify-end">
            <Button
              onClick={() =>
                submitForApproval.mutate({ invoiceId: invoice.id })
              }
              disabled={submitForApproval.isPending}
            >
              {submitForApproval.isPending
                ? t("detail.submittingForApproval")
                : t("detail.submitForApproval")}
            </Button>
          </div>
        )}

        {/* Chain tracker (per D-04) */}
        {hasApprovalFlow && <ChainTracker invoiceId={invoice.id} />}

        {/* Audit timeline (per D-11, D-12, D-13) */}
        {hasApprovalFlow && <AuditTimeline invoiceId={invoice.id} />}

        {/* Metadata form */}
        <InvoiceMetadataForm
          invoice={invoice}
          onSubmittedForMatching={() => {
            queryClient.invalidateQueries({
              queryKey: trpc.invoice.getById.queryKey({ id: invoice.id }),
            });
          }}
        />
      </InvoiceDetailLayout>
    </div>
  );
}
