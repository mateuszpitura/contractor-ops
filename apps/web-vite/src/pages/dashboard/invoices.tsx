/**
 * Invoices list — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  InvoicesIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Check, Copy, Mail, Receipt, Upload, Users } from 'lucide-react';
import { Suspense } from 'react';

import { EInvoiceComplianceFilterChips } from '../../components/invoices/einvoice-compliance-filter-chips.js';
import { EInvoiceComplianceSummaryTile } from '../../components/invoices/einvoice-compliance-summary-tile.js';
import { useInvoicesListPage } from '../../components/invoices/hooks/use-invoices-list-page.js';
import { ImportSplitButton } from '../../components/invoices/intake/import-split-button.js';
import { InvoiceSidePanel } from '../../components/invoices/invoice-side-panel.js';
import { InvoiceDataTable } from '../../components/invoices/invoice-table/data-table.js';
import { DataTableToolbar } from '../../components/invoices/invoice-table/data-table-toolbar.js';
import { InvoiceUploadArea } from '../../components/invoices/invoice-upload-area.js';
import { StatusChipBar } from '../../components/invoices/status-chip-bar.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { isListControlsDisabled } from '../../components/shared/list-controls-disabled.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function InvoicesListPageContent() {
  const t = useTranslations('Invoices');
  const {
    list,
    invoiceEmail,
    selectedInvoice,
    sidePanelOpen,
    setSidePanelOpen,
    uploadOpen,
    emailCopied,
    handleUpload,
    handleRowClick,
    handleUploadComplete,
    handleCopyEmail,
    handleComplianceReview,
    handleStatusChange,
  } = useInvoicesListPage();

  const controlsDisabled = isListControlsDisabled({ isLoading: list.isCountLoading });

  if (list.showEmptyState) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_CLASS}>
        <AnimateIn delay={0}>
          <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>

        <AnimateIn delay={1} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AtelierEmptyState
            variant="page"
            illustration={InvoicesIllustration}
            heading={list.emptyProps.heading}
            body={list.emptyProps.body}
            primaryAction={{
              label: list.emptyProps.cta,
              onClick: handleUpload,
              icon: Upload,
            }}
            secondaryAction={{
              label: list.emptyProps.secondary,
              href: '/settings',
              icon: Mail,
            }}
            prerequisiteMissing={list.contractorCount === 0}
            prerequisiteAction={{
              label: list.emptyProps.prerequisiteCta,
              href: '/contractors',
              icon: Users,
            }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>

        <InvoiceSidePanel
          invoice={selectedInvoice}
          open={sidePanelOpen}
          onOpenChange={setSidePanelOpen}
        />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <ImportSplitButton disabled={controlsDisabled} onCreateNewClick={handleUpload} />
          }
        />
      </AnimateIn>

      <AnimateIn delay={1} className="w-full min-w-0 shrink-0">
        <EInvoiceComplianceSummaryTile onReviewFilterRequested={handleComplianceReview} />
      </AnimateIn>
      <AnimateIn delay={2} className="min-w-0 shrink-0">
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('complianceFilterLabel')}
          </h3>
          <div className="min-w-0 overflow-x-auto">
            <EInvoiceComplianceFilterChips disabled={controlsDisabled} />
          </div>
        </div>
      </AnimateIn>

      {!!uploadOpen && (
        <div className="space-y-3">
          <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
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

      <AnimateIn delay={4} className="flex min-h-0 flex-1 flex-col">
        <section
          data-slot="invoices-table-region"
          aria-label={t('pageTitle')}
          className={WORKBENCH_TABLE_SECTION_CLASS}>
          <SectionLabel icon={Receipt}>{t('pageTitle')}</SectionLabel>
          <StatusChipBar
            activeStatuses={list.tableProps.filters.status}
            onStatusChange={handleStatusChange}
            disabled={controlsDisabled}
          />
          <InvoiceDataTable
            {...list.tableProps}
            onRowClick={handleRowClick}
            onUpload={handleUpload}
            parentLoading={controlsDisabled}
            toolbar={<DataTableToolbar {...list.toolbarProps} />}
            sectionClassName=""
          />
        </section>
      </AnimateIn>

      <InvoiceSidePanel
        invoice={selectedInvoice}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoicesListPageContent />
    </Suspense>
  );
}
