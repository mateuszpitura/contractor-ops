"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusTimeline, StatusTimelineSkeleton } from "@/components/portal/status-timeline";
import { ActivityLog } from "@/components/portal/activity-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

// ---------------------------------------------------------------------------
// Status badge mapping (shared with list page)
// ---------------------------------------------------------------------------

function getStatusDisplay(
  invoice: {
    status: string;
    approvalStatus: string;
    paymentStatus: string;
  },
  t: ReturnType<typeof useTranslations<"Portal">>,
): { label: string; variant: "info" | "warning" | "success" | "success-outline" | "success-solid" | "destructive" } {
  if (invoice.paymentStatus === "PAID")
    return { label: t("invoices.status.paid"), variant: "success-solid" };
  if (invoice.paymentStatus === "IN_RUN")
    return { label: t("invoices.status.paymentScheduled"), variant: "success-outline" };
  if (invoice.approvalStatus === "APPROVED")
    return { label: t("invoices.status.approved"), variant: "success" };
  if (invoice.status === "REJECTED")
    return { label: t("invoices.status.rejected"), variant: "destructive" };
  if (
    invoice.status === "UNDER_REVIEW" ||
    invoice.status === "APPROVAL_PENDING"
  )
    return { label: t("invoices.status.inReview"), variant: "warning" };
  return { label: t("invoices.status.submitted"), variant: "info" };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <StatusTimelineSkeleton />
      <Card>
        <CardContent className="space-y-4 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-6 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortalInvoiceDetailPage() {
  const t = useTranslations("Portal");
  const params = useParams<{ id: string }>();

  const { data: invoice, isLoading } = useQuery(
    trpc.portal.getInvoice.queryOptions({ id: params.id }),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t("invoiceDetail.back")}
          </Button>
        </Link>
        <DetailSkeleton />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t("invoiceDetail.back")}
          </Button>
        </Link>
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("invoiceDetail.notFound")}
        </p>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(invoice, t);

  // Derive submitted date from activity log
  const submittedEntry = invoice.activityLog.find(
    (e) => e.event.toLowerCase().includes("submitted"),
  );
  const submittedDate = submittedEntry?.timestamp;

  // Check if rejected
  const rejectedEntry = invoice.activityLog.find(
    (e) => e.event.toLowerCase().includes("rejected"),
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/portal/invoices">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="me-1.5 h-4 w-4" />
          {t("invoiceDetail.back")}
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{invoice.invoiceNumber}</h1>
        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
        {submittedDate && (
          <span className="text-[13px] text-muted-foreground">
            {t("invoiceDetail.submitted", { date: formatDate(submittedDate) })}
          </span>
        )}
      </div>

      {/* Status Timeline */}
      <StatusTimeline
        status={invoice.status}
        approvalStatus={invoice.approvalStatus}
        paymentStatus={invoice.paymentStatus}
        rejectedAt={rejectedEntry?.timestamp ?? null}
      />

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("invoiceDetail.details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">{t("invoiceDetail.contract")}</span>
            {invoice.contract ? (
              <Link
                href={`/portal/contracts/${invoice.contract.id}`}
                className="text-sm text-primary hover:underline"
              >
                {invoice.contract.title}
              </Link>
            ) : (
              <span className="text-sm">{t("invoiceDetail.fallback")}</span>
            )}
          </div>
          <Separator />

          {/* Amounts */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t("invoiceDetail.netAmount")}
            </span>
            <span className="text-sm">
              {formatAmount(invoice.subtotalMinor, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t("invoiceDetail.grossAmount")}
            </span>
            <span className="text-sm font-medium">
              {formatAmount(invoice.totalMinor, invoice.currency)}
            </span>
          </div>
          <Separator />

          {/* Dates */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t("invoiceDetail.issueDate")}
            </span>
            <span className="text-sm">
              {invoice.issueDate ? formatDate(invoice.issueDate) : t("invoiceDetail.fallback")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">{t("invoiceDetail.dueDate")}</span>
            <span className="text-sm">
              {invoice.dueDate ? formatDate(invoice.dueDate) : t("invoiceDetail.fallback")}
            </span>
          </div>
          <Separator />

          {/* Attached files */}
          {invoice.files.length > 0 && (
            <div className="space-y-2">
              <span className="text-[13px] text-muted-foreground">
                {t("invoiceDetail.attachedFiles")}
              </span>
              {invoice.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{file.name}</span>
                  <a
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    <Button variant="outline" size="sm">
                      <Download className="me-1.5 h-3.5 w-3.5" />
                      {t("invoiceDetail.download")}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment section (only when payment data exists) */}
      {invoice.payment && (
        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceDetail.payment")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t("invoiceDetail.paymentDate")}
              </span>
              <span className="text-sm">
                {invoice.payment.paidAt
                  ? formatDate(invoice.payment.paidAt)
                  : t("invoiceDetail.fallback")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">{t("invoiceDetail.amount")}</span>
              <span className="text-sm font-medium">
                {formatAmount(
                  invoice.payment.amountMinor,
                  invoice.payment.currency,
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{t("invoiceDetail.activity")}</h2>
        <ActivityLog entries={invoice.activityLog} />
      </div>
    </div>
  );
}
