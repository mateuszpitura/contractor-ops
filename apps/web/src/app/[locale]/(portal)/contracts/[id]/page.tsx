"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";

import { trpc } from "@/trpc/init";
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

function formatContractType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ratePeriodLabel(rateType: string): string {
  switch (rateType) {
    case "MONTHLY":
      return "/mo";
    case "HOURLY":
      return "/hr";
    case "DAILY":
      return "/day";
    case "FIXED":
      return " fixed";
    default:
      return "";
  }
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "EXPIRING":
      return "outline" as const;
    case "EXPIRED":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal contract detail page (read-only).
 *
 * Per UI-SPEC Contract Detail and PORT-02:
 * - Back button to contracts list
 * - Title + status badge
 * - Detail fields in 2-col grid
 * - Rate periods table (if any)
 * - Documents section with download buttons
 */
export default function PortalContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const contractQuery = useQuery(trpc.portal.getContract.queryOptions({ id }));
  const contract = contractQuery.data;
  const isLoading = contractQuery.isPending;

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-7 w-32" />
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Contract not found.</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          render={<Link href="/portal/contracts" />}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Contracts
        </Button>
      </div>
    );
  }

  const rateDisplay =
    contract.rateValueGrosze != null && contract.rateType
      ? `${formatAmount(contract.rateValueGrosze, contract.currency)}${ratePeriodLabel(contract.rateType)}`
      : "N/A";

  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/portal/contracts" />}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Contracts
      </Button>

      {/* Header */}
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{contract.title}</h1>
        <Badge variant={statusBadgeVariant(contract.status)}>
          {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Details grid */}
      <Card className="mt-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <DetailField label="Contract Number" value={contract.contractNumber ?? "N/A"} />
          <DetailField label="Type" value={formatContractType(contract.type)} />
          <DetailField label="Start Date" value={formatDate(contract.startDate)} />
          <DetailField label="End Date" value={formatDate(contract.endDate)} />
          <DetailField label="Rate" value={rateDisplay} />
          <DetailField
            label="Billing Model"
            value={formatContractType(contract.billingModel ?? "N/A")}
          />
          <DetailField
            label="Payment Terms"
            value={
              contract.paymentTermsDays != null
                ? `${contract.paymentTermsDays} days`
                : "N/A"
            }
          />
          <DetailField
            label="Auto-Renewal"
            value={contract.autoRenewal ? "Yes" : "No"}
          />
          <DetailField
            label="Notice Period"
            value={
              contract.noticePeriodDays != null
                ? `${contract.noticePeriodDays} days`
                : "N/A"
            }
          />
        </CardContent>
      </Card>

      {/* Rate Periods */}
      {contract.ratePeriods && contract.ratePeriods.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Rate Periods</h2>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Rate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.ratePeriods.map((period, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {formatAmount(period.rateValueGrosze, period.currency)}
                  </TableCell>
                  <TableCell>{formatContractType(period.rateType)}</TableCell>
                  <TableCell>{formatDate(period.validFrom)}</TableCell>
                  <TableCell>{formatDate(period.validTo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Documents */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold">Documents</h2>
        {contract.documents && contract.documents.length > 0 ? (
          <div className="mt-4 space-y-2">
            {contract.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary">
                      {formatContractType(doc.type ?? "Document")}
                    </Badge>
                    <span className="text-[13px] text-muted-foreground">
                      {formatFileSize(doc.sizeBytes)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(doc.downloadUrl, "_blank")}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No documents attached to this contract.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailField sub-component
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
