/**
 * Payments list — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  PaymentsIllustration,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { CreditCard, FileText, Plus, Users } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';

import { BankStatementDialog } from '../../components/payments/bank-statement-dialog.js';
import { usePaymentsList } from '../../components/payments/hooks/use-payments-list.js';
import { NewPaymentRunDialog } from '../../components/payments/new-payment-run-dialog/index.js';
import { PaymentRunSidePanel } from '../../components/payments/payment-run-side-panel.js';
import { PaymentRunDataTable } from '../../components/payments/payment-run-table/data-table.js';
import { DataTableToolbar } from '../../components/payments/payment-run-table/data-table-toolbar.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { isListControlsDisabled } from '../../components/shared/list-controls-disabled.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function PaymentsPageContent() {
  const t = useTranslations('Payments');
  const te = useTranslations('EmptyStates');

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankStatementRunId, setBankStatementRunId] = useState<string | null>(null);

  const handleOpenSidePanel = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setSidePanelOpen(true);
  }, []);

  const list = usePaymentsList({ onOpenSidePanel: handleOpenSidePanel });
  const controlsDisabled = isListControlsDisabled({
    isLoading: list.isLoading,
    isFetching: list.isFetching,
  });

  const handleSidePanelOpenChange = useCallback((open: boolean) => {
    setSidePanelOpen(open);
    if (!open) setSelectedRunId(null);
  }, []);

  const handleViewRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setSidePanelOpen(true);
  }, []);

  const handleOpenDialog = useCallback(() => setDialogOpen(true), []);

  const handleBankStatementOpenChange = useCallback((open: boolean) => {
    if (!open) setBankStatementRunId(null);
  }, []);

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('pageDescription')}
          actions={
            <Button
              size="sm"
              className="gap-1.5"
              disabled={controlsDisabled}
              onClick={handleOpenDialog}>
              <Plus className="h-3.5 w-3.5" />
              {t('newPaymentRun')}
            </Button>
          }
        />
      </AnimateIn>

      {list.showEmptyState ? (
        <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
          <AtelierEmptyState
            illustration={PaymentsIllustration}
            heading={te('payments.heading')}
            body={te('payments.body')}
            primaryAction={{ label: te('payments.cta'), href: '/invoices', icon: FileText }}
            prerequisiteMissing={list.contractorCount === 0}
            prerequisiteAction={{
              label: te('prerequisite.cta'),
              href: '/contractors',
              icon: Users,
            }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
      ) : (
        <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
          <section aria-label={t('title')} className={WORKBENCH_TABLE_SECTION_CLASS}>
            <SectionLabel icon={CreditCard}>{t('title')}</SectionLabel>

            <div className={WORKBENCH_DATA_TABLE_CLASS}>
              <DataTableToolbar {...list.toolbarProps} />
              <PaymentRunDataTable {...list.tableProps} sectionClassName="" />
            </div>
          </section>
        </AnimateIn>
      )}

      <PaymentRunSidePanel
        runId={selectedRunId}
        open={sidePanelOpen}
        onOpenChange={handleSidePanelOpenChange}
        onImportStatement={setBankStatementRunId}
      />

      <NewPaymentRunDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onViewRun={handleViewRun}
      />

      {!!bankStatementRunId && (
        <BankStatementDialog
          runId={bankStatementRunId}
          open={!!bankStatementRunId}
          onOpenChange={handleBankStatementOpenChange}
        />
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PaymentsPageContent />
    </Suspense>
  );
}
