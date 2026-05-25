import {
  AtelierEmptyState,
  AtelierPageHeader,
  InvoicesIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Check, Copy, Mail, Receipt, Upload, Users } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { EInvoiceComplianceFilterChips } from './einvoice-compliance-filter-chips.js';
import { EInvoiceComplianceSummaryTileContainer } from './einvoice-compliance-summary-tile-container.js';
import { useInvoicesListPage } from './hooks/use-invoices-list-page.js';
import { ImportSplitButtonContainer } from './intake/import-split-button-container.js';
import { InvoiceSidePanel } from './invoice-side-panel.js';
import { InvoiceDataTable } from './invoice-table/data-table.js';
import { DataTableToolbar } from './invoice-table/data-table-toolbar.js';
import { InvoiceUploadAreaContainer } from './invoice-upload-area-container.js';
import { StatusChipBarContainer } from './status-chip-bar-container.js';

export function InvoicesListContainer() {
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

  if (list.showEmptyState) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_CLASS}>
        <AnimateIn delay={0}>
          <AtelierPageHeader
            title={t('pageTitle')}
            description={t('pageDescription')}
            actions={<ImportSplitButtonContainer onCreateNewClick={handleUpload} />}
          />
        </AnimateIn>

        <AnimateIn delay={1} className="shrink-0">
          <EInvoiceComplianceSummaryTileContainer
            onReviewFilterRequested={handleComplianceReview}
          />
        </AnimateIn>
        <AnimateIn delay={2} className="shrink-0">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('complianceFilterLabel')}
            </h3>
            <EInvoiceComplianceFilterChips disabled={list.isCountLoading} />
          </div>
        </AnimateIn>

        <AnimateIn delay={4}>
          <AtelierEmptyState
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
        <AtelierPageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={<ImportSplitButtonContainer onCreateNewClick={handleUpload} />}
        />
      </AnimateIn>

      <AnimateIn delay={1} className="shrink-0">
        <EInvoiceComplianceSummaryTileContainer onReviewFilterRequested={handleComplianceReview} />
      </AnimateIn>
      <AnimateIn delay={2} className="shrink-0">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('complianceFilterLabel')}
          </h3>
          <EInvoiceComplianceFilterChips disabled={list.isCountLoading} />
        </div>
      </AnimateIn>

      {!!uploadOpen && (
        <div className="space-y-3">
          <InvoiceUploadAreaContainer onUploadComplete={handleUploadComplete} />
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
          <StatusChipBarContainer
            activeStatuses={list.tableProps.filters.status}
            onStatusChange={handleStatusChange}
            disabled={list.isCountLoading}
          />
          <InvoiceDataTable
            {...list.tableProps}
            onRowClick={handleRowClick}
            onUpload={handleUpload}
            parentLoading={list.isCountLoading}
            toolbar={<DataTableToolbar {...list.toolbarProps} />}
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
