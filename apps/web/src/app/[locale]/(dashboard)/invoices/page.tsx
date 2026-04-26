'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Receipt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { EInvoiceComplianceFilterChips } from '@/components/invoices/einvoice-compliance-filter-chips';
import { EInvoiceComplianceSummaryTile } from '@/components/invoices/einvoice-compliance-summary-tile';
import { ImportSplitButton } from '@/components/invoices/intake/import-split-button';
import { InvoiceSidePanel } from '@/components/invoices/invoice-side-panel';
import type { InvoiceRow } from '@/components/invoices/invoice-table/columns';
import { InvoiceDataTable } from '@/components/invoices/invoice-table/data-table';
import { useInvoiceFilters } from '@/components/invoices/invoice-table/use-invoice-filters';
import { InvoiceUploadArea } from '@/components/invoices/invoice-upload-area';
import { StatusChipBar } from '@/components/invoices/status-chip-bar';
import { AnimateIn } from '@/components/shared/animate-in';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Email inbox address (constructed from placeholder org slug)
// ---------------------------------------------------------------------------

function useInvoiceEmail(): string {
  // In production, this would come from org settings.
  // For now, construct from a placeholder.
  return 'invoices@your-org.contractorhub.io';
}

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, requires Suspense)
// ---------------------------------------------------------------------------

function InvoicesContent() {
  const t = useTranslations('Invoices');
  const te = useTranslations('EmptyStates');
  const invoiceEmail = useInvoiceEmail();

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [action, setAction] = useQueryState('action', parseAsString);

  useEffect(() => {
    if (action === 'upload') {
      setUploadOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  // URL-synced filter state for chip bar integration
  const [filters, setFilters] = useInvoiceFilters();

  // Count queries for empty state detection
  const invoiceCountQuery = useQuery(trpc.invoice.list.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const invoiceTotal = (invoiceCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = invoiceCountQuery.isLoading;

  const handleRowClick = useCallback((invoice: InvoiceRow) => {
    setSelectedInvoice(invoice);
    setSidePanelOpen(true);
  }, []);

  const handleUpload = useCallback(() => {
    setUploadOpen(prev => !prev);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
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

  const handleComplianceReview = useCallback(() => {
    // "Review N invoice(s)" CTA → multi-select invalid + failed. Updates
    // URL via next/navigation so chips pick up the state declaratively.
    const params = new URLSearchParams(window.location.search);
    params.set('einvoiceStatus', 'invalid,failed');
    window.history.replaceState(null, '', `?${params.toString()}`);
    // Scroll the invoices table into view so the filtered set is visible.
    document
      .querySelector('[data-slot=invoices-table-region]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Show empty state when no invoices exist
  if (!isCountLoading && invoiceTotal === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('pageTitle')} description={t('pageDescription')} />
        {uploadOpen ? (
          <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
        ) : (
          <EmptyState
            icon={Receipt}
            heading={te('invoices.heading')}
            body={te('invoices.body')}
            primaryAction={{ label: te('invoices.cta'), onClick: handleUpload }}
            secondaryAction={{ label: te('invoices.secondary'), href: '/settings' }}
            prerequisiteMissing={contractorCount === 0}
            prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header — Phase 62 adds the ImportSplitButton which, when the
          einvoice.import-enabled flag is on, surfaces 'Import e-invoice' as
          a secondary dropdown item alongside the primary '+ New invoice' CTA. */}
      <AnimateIn delay={0}>
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={<ImportSplitButton onCreateNewClick={handleUpload} />}
        />
      </AnimateIn>

      {/* Phase 61 · Plan 61-08 — compliance summary tile + filter chips */}
      <AnimateIn delay={1}>
        <EInvoiceComplianceSummaryTile onReviewFilterRequested={handleComplianceReview} />
      </AnimateIn>
      <AnimateIn delay={2}>
        <EInvoiceComplianceFilterChips />
      </AnimateIn>

      {/* Status chip bar */}
      <AnimateIn delay={3}>
        <StatusChipBar activeStatus={filters.matchStatus} onStatusChange={handleStatusChange} />
      </AnimateIn>

      {/* Upload area (collapsible) */}
      {!!uploadOpen && (
        <div className="space-y-3">
          <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
          {/* Email inbox tip */}
          <p className="text-sm text-muted-foreground text-center">
            {t('upload.emailTip', { email: '' })}
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 ms-1 font-medium text-primary hover:underline">
              {invoiceEmail}
              {emailCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </p>
        </div>
      )}

      {/* Data table */}
      <div data-slot="invoices-table-region">
        <InvoiceDataTable onRowClick={handleRowClick} onUpload={handleUpload} />
      </div>

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
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`skel-${i}`} className="h-8 w-24 rounded-full" />
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
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              key={`skel-${i}`}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
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
