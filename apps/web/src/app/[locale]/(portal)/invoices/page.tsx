"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
// Status badge mapping
// ---------------------------------------------------------------------------

type InvoiceStatusDisplay = {
  label: string;
  variant: "info" | "warning" | "success" | "success-outline" | "success-solid" | "destructive";
};

function getStatusDisplay(invoice: {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
}): InvoiceStatusDisplay {
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

function InvoiceListSkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-xl font-semibold">No Invoices Yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You haven&apos;t submitted any invoices. Submit your first invoice to
        get started.
      </p>
      <Link href="/portal/invoices/submit">
        <Button className="mt-6">
          <Plus className="mr-1.5 h-4 w-4" />
          Submit Invoice
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortalInvoicesPage() {
  const router = useRouter();

  const { data: invoices, isLoading } = useQuery(
    trpc.portal.listInvoices.queryOptions(),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link href="/portal/invoices/submit">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            Submit Invoice
          </Button>
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <InvoiceListSkeleton />
      ) : !invoices || invoices.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusDisplay = getStatusDisplay(invoice);
                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/portal/invoices/${invoice.id}`)
                      }
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
                        {invoice.contract?.title ?? "-"}
                      </TableCell>
                      <TableCell>
                        {formatAmount(invoice.totalGrosze, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.receivedAt
                          ? formatDate(invoice.receivedAt)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusDisplay.variant}>
                          {statusDisplay.label}
                        </Badge>
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
              const statusDisplay = getStatusDisplay(invoice);
              return (
                <Link
                  key={invoice.id}
                  href={`/portal/invoices/${invoice.id}`}
                  className="block"
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {invoice.invoiceNumber}
                        </span>
                        <span className="text-sm font-medium">
                          {formatAmount(invoice.totalGrosze, invoice.currency)}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        {invoice.contract?.title ?? "-"}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant={statusDisplay.variant}>
                          {statusDisplay.label}
                        </Badge>
                        <span className="text-[13px] text-muted-foreground">
                          {invoice.receivedAt
                            ? formatDate(invoice.receivedAt)
                            : "-"}
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
