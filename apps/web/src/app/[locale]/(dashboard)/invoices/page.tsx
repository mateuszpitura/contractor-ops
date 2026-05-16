'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  InvoicesIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Mail, Receipt, Upload, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { EInvoiceComplianceFilterChips } from '@/components/invoices/einvoice-compliance-filter-chips';
import { EInvoiceComplianceSummaryTile } from '@/components/invoices/einvoice-compliance-summary-tile';
import { ImportSplitButton } from '@/components/invoices/intake/import-split-button';
import { InvoiceSidePanel } from '@/components/invoices/invoice-side-panel';
import type { InvoiceRow } from '@/components/invoices/invoice-table/columns';
import { InvoiceDataTable } from '@/components/invoices/invoice-table/data-table';
import { InvoiceUploadArea } from '@/components/invoices/invoice-upload-area';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
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

  // Empty state shown inline within the chrome — keeps SummaryTile + filter
  // chips + status bar mounted across the loading→empty transition, so
  // height doesn't collapse when count resolves to zero.
  const isEmptyResolved = !isCountLoading && invoiceTotal === 0;

  return (
    <div className="space-y-6">
      {/* Page header — Phase 62 adds the ImportSplitButton which, when the
          einvoice.import-enabled flag is on, surfaces 'Import e-invoice' as
          a secondary dropdown item alongside the primary '+ New invoice' CTA. */}
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={<ImportSplitButton onCreateNewClick={handleUpload} />}
        />
      </AnimateIn>

      {/* Phase 61 · Plan 61-08 — compliance summary tile + filter tabs */}
      <AnimateIn delay={1}>
        <EInvoiceComplianceSummaryTile onReviewFilterRequested={handleComplianceReview} />
      </AnimateIn>
      <AnimateIn delay={2}>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('complianceFilterLabel')}
          </h3>
          <EInvoiceComplianceFilterChips disabled={isCountLoading} />
        </div>
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

      {/* Directory section — swap to AtelierEmptyState inline once count
          resolves to zero, so the chrome above stays mounted (no jump). */}
      <AnimateIn delay={4}>
        {isEmptyResolved ? (
          <AtelierEmptyState
            illustration={InvoicesIllustration}
            heading={te('invoices.heading')}
            body={te('invoices.body')}
            primaryAction={{ label: te('invoices.cta'), onClick: handleUpload, icon: Upload }}
            secondaryAction={{ label: te('invoices.secondary'), href: '/settings', icon: Mail }}
            prerequisiteMissing={contractorCount === 0}
            prerequisiteAction={{
              label: te('prerequisite.cta'),
              href: '/contractors',
              icon: Users,
            }}
            renderAction={renderEmptyStateAction}
          />
        ) : (
          <section
            data-slot="invoices-table-region"
            aria-label={t('pageTitle')}
            className="space-y-3">
            <SectionLabel icon={Receipt}>{t('pageTitle')}</SectionLabel>
            <InvoiceDataTable
              onRowClick={handleRowClick}
              onUpload={handleUpload}
              parentLoading={isCountLoading}
            />
          </section>
        )}
      </AnimateIn>

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
// Page export
// ---------------------------------------------------------------------------

/**
 * Invoice list page at /invoices.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoicesContent />
    </Suspense>
  );
}
