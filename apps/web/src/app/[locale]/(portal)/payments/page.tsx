"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatAmount(grosze: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(grosze / 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal payments list page.
 *
 * Per UI-SPEC Payments List, PORT-04, and D-12:
 * - Table with Invoice Number, Amount, Payment Date, Status
 * - No internal batch IDs or org bank details exposed
 * - Click row to navigate to invoice detail
 * - Loading: table header + 3 row skeletons
 * - Empty state with specific copy from UI-SPEC
 */
export default function PortalPaymentsPage() {
  const router = useRouter();
  const paymentsQuery = useQuery(trpc.portal.listPayments.queryOptions());
  const payments = paymentsQuery.data;
  const isLoading = paymentsQuery.isPending;

  return (
    <div>
      <h1 className="text-xl font-semibold">Payments</h1>

      {isLoading ? (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : payments && payments.length > 0 ? (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/portal/invoices/${payment.id}`)
                  }
                >
                  <TableCell className="text-sm font-medium">
                    {payment.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatAmount(payment.amountGrosze, payment.currency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(payment.paidAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">Paid</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Banknote}
          heading="No Payments Yet"
          body="Payment records will appear here once your invoices are approved and processed."
        />
      )}
    </div>
  );
}
