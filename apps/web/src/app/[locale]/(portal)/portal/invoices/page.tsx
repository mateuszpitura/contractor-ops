"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";

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
// Status badge mapping
// ---------------------------------------------------------------------------

type InvoiceStatusDisplay = {
  label: string;
  variant: "info" | "warning" | "success" | "success-outline" | "success-solid" | "destructive";
};

function getStatusDisplay(
  invoice: {
    status: string;
    approvalStatus: string;
    paymentStatus: string;
  },
  t: ReturnType<typeof useTranslations<"Portal">>,
): InvoiceStatusDisplay {
  if (invoice.paymentStatus === "PAID")
    return { label: t("invoices.status.paid"), variant: "success-solid" };
  if (invoice.paymentStatus === "IN_RUN")
    return { label: t("invoices.status.paymentScheduled"), variant: "success-outline" };
  if (invoice.approvalStatus === "APPROVED")
    return { label: t("invoices.status.approved"), variant: "success" };
  if (invoice.status === "REJECTED")
    return { label: t("invoices.status.rejected"), variant: "destructive" };
  if (invoice.status === "UNDER_REVIEW" || invoice.status === "APPROVAL_PENDING")
    return { label: t("invoices.status.inReview"), variant: "warning" };
  return { label: t("invoices.status.submitted"), variant: "info" };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InvoiceListSkeleton({ t }: { t: ReturnType<typeof useTranslations<"Portal">> }) {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoices.columns.invoiceNumber")}</TableHead>
              <TableHead>{t("invoices.columns.contract")}</TableHead>
              <TableHead>{t("invoices.columns.amount")}</TableHead>
              <TableHead>{t("invoices.columns.dateSubmitted")}</TableHead>
              <TableHead>{t("invoices.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile skeleton */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-36" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function InvoicesEmptyState({ t }: { t: ReturnType<typeof useTranslations<"Portal">> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-xl font-semibold">{t("invoices.emptyTitle")}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("invoices.emptyBody")}</p>
      <Link href="/portal/invoices/submit">
        <Button className="mt-6">
          <Plus className="me-1.5 h-4 w-4" />
          {t("invoices.submitInvoice")}
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortalInvoicesPage() {
  const t = useTranslations("Portal");
  const router = useRouter();

  const { data: invoices, isLoading } = useQuery(trpc.portal.listInvoices.queryOptions());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("invoices.title")}</h1>
        <Link href="/portal/invoices/submit">
          <Button>
            <Plus className="me-1.5 h-4 w-4" />
            {t("invoices.submitInvoice")}
          </Button>
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <InvoiceListSkeleton t={t} />
      ) : !invoices || invoices.length === 0 ? (
        <InvoicesEmptyState t={t} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.columns.invoiceNumber")}</TableHead>
                  <TableHead>{t("invoices.columns.contract")}</TableHead>
                  <TableHead>{t("invoices.columns.amount")}</TableHead>
                  <TableHead>{t("invoices.columns.dateSubmitted")}</TableHead>
                  <TableHead>{t("invoices.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusDisplay = getStatusDisplay(invoice, t);
                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/portal/invoices/${invoice.id}`)}
                    >
                      <TableCell>
                        <Link
                          href={`/portal/invoices/${invoice.id}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.contract?.title ?? t("invoices.fallback")}
                      </TableCell>
                      <TableCell>{formatAmount(invoice.totalMinor, invoice.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.receivedAt
                          ? formatDate(invoice.receivedAt)
                          : t("invoices.fallback")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {invoices.map((invoice) => {
              const statusDisplay = getStatusDisplay(invoice, t);
              return (
                <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                        <span className="text-sm font-medium">
                          {formatAmount(invoice.totalMinor, invoice.currency)}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        {invoice.contract?.title ?? t("invoices.fallback")}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
                        <span className="text-[13px] text-muted-foreground">
                          {invoice.receivedAt
                            ? formatDate(invoice.receivedAt)
                            : t("invoices.fallback")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
