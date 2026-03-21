"use client";

import { Suspense, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Copy, Check } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { InvoiceDataTable } from "@/components/invoices/invoice-table/data-table";
import { StatusChipBar } from "@/components/invoices/status-chip-bar";
import { InvoiceSidePanel } from "@/components/invoices/invoice-side-panel";
import { InvoiceUploadArea } from "@/components/invoices/invoice-upload-area";
import type { InvoiceRow } from "@/components/invoices/invoice-table/columns";
import { useInvoiceFilters } from "@/components/invoices/invoice-table/use-invoice-filters";

// ---------------------------------------------------------------------------
// Email inbox address (constructed from placeholder org slug)
// ---------------------------------------------------------------------------

function useInvoiceEmail(): string {
  // In production, this would come from org settings.
  // For now, construct from a placeholder.
  return "invoices@your-org.contractorhub.io";
}

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, requires Suspense)
// ---------------------------------------------------------------------------

function InvoicesContent() {
  const t = useTranslations("Invoices");
  const invoiceEmail = useInvoiceEmail();

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(
    null,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // URL-synced filter state for chip bar integration
  const [filters, setFilters] = useInvoiceFilters();

  const handleRowClick = useCallback((invoice: InvoiceRow) => {
    setSelectedInvoice(invoice);
    setSidePanelOpen(true);
  }, []);

  const handleUpload = useCallback(() => {
    setUploadOpen((prev) => !prev);
  }, []);

  const handleStatusChange = useCallback(
    (status: string) => {
      void setFilters({ matchStatus: status, page: 1 });
    },
    [setFilters],
  );

  const handleCopyEmail = useCallback(() => {
    navigator.clipboard.writeText(invoiceEmail).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  }, [invoiceEmail]);

  // Determine if we should show empty state
  // This is handled inside InvoiceDataTable via the table empty state,
  // but we check filters to only show the full empty state when truly empty

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
      </div>

      {/* Status chip bar */}
      <StatusChipBar
        activeStatus={filters.matchStatus}
        onStatusChange={handleStatusChange}
      />

      {/* Upload area (collapsible) */}
      {uploadOpen && (
        <div className="space-y-3">
          <InvoiceUploadArea
            onUploadComplete={() => setUploadOpen(false)}
          />
          {/* Email inbox tip */}
          <p className="text-sm text-muted-foreground text-center">
            {t("upload.emailTip", { email: "" })}
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 ml-1 font-medium text-primary hover:underline"
            >
              {invoiceEmail}
              {emailCopied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </p>
        </div>
      )}

      {/* Data table */}
      <InvoiceDataTable onRowClick={handleRowClick} onUpload={handleUpload} />

      {/* Side panel */}
      <InvoiceSidePanel
        invoice={selectedInvoice}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function InvoicesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      {/* Chip bar skeleton */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-xl border bg-background">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Invoice list page at /invoices.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesLoading />}>
      <InvoicesContent />
    </Suspense>
  );
}
