"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";

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

function formatAmount(grosze: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
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

function getStatusDisplay(invoice: {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
}): { label: string; variant: "info" | "warning" | "success" | "success-outline" | "success-solid" | "destructive" } {
  if (invoice.paymentStatus === "PAID")
    return { label: "Paid", variant: "success-solid" };
  if (invoice.paymentStatus === "IN_RUN")
    return { label: "Payment Scheduled", variant: "success-outline" };
  if (invoice.approvalStatus === "APPROVED")
    return { label: "Approved", variant: "success" };
  if (invoice.status === "REJECTED")
    return { label: "Rejected", variant: "destructive" };
  if (
    invoice.status === "UNDER_REVIEW" ||
    invoice.status === "APPROVAL_PENDING"
  )
    return { label: "In Review", variant: "warning" };
  return { label: "Submitted", variant: "info" };
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
  const params = useParams<{ id: string }>();

  const { data: invoice, isLoading } = useQuery(
    trpc.portal.getInvoice.queryOptions({ id: params.id }),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
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
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        </Link>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Invoice not found.
        </p>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(invoice);

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
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{invoice.invoiceNumber}</h1>
        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
        {submittedDate && (
          <span className="text-[13px] text-muted-foreground">
            Submitted {formatDate(submittedDate)}
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
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Contract</span>
            {invoice.contract ? (
              <Link
                href={`/portal/contracts/${invoice.contract.id}`}
                className="text-sm text-primary hover:underline"
              >
                {invoice.contract.title}
              </Link>
            ) : (
              <span className="text-sm">-</span>
            )}
          </div>
          <Separator />

          {/* Amounts */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              Net Amount
            </span>
            <span className="text-sm">
              {formatAmount(invoice.subtotalGrosze, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              Gross Amount
            </span>
            <span className="text-sm font-medium">
              {formatAmount(invoice.totalGrosze, invoice.currency)}
            </span>
          </div>
          <Separator />

          {/* Dates */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              Issue Date
            </span>
            <span className="text-sm">
              {invoice.issueDate ? formatDate(invoice.issueDate) : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Due Date</span>
            <span className="text-sm">
              {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
            </span>
          </div>
          <Separator />

          {/* Attached files */}
          {invoice.files.length > 0 && (
            <div className="space-y-2">
              <span className="text-[13px] text-muted-foreground">
                Attached Files
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
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
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
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                Payment Date
              </span>
              <span className="text-sm">
                {invoice.payment.paidAt
                  ? formatDate(invoice.payment.paidAt)
                  : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Amount</span>
              <span className="text-sm font-medium">
                {formatAmount(
                  invoice.payment.amountGrosze,
                  invoice.payment.currency,
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Activity</h2>
        <ActivityLog entries={invoice.activityLog} />
      </div>
    </div>
  );
}
