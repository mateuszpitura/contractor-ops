import {
  AtelierEmptyState,
  PaymentsIllustration,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { CreditCard, FileText, Plus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { isListControlsDisabled } from '../shared/list-controls-disabled.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { BankStatementDialogContainer } from './bank-statement-dialog-container.js';
import { usePaymentsList } from './hooks/use-payments-list.js';
import { NewPaymentRunDialogContainer } from './new-payment-run-dialog/index.js';
import { PaymentRunSidePanelContainer } from './payment-run-side-panel-container.js';
import { PaymentRunDataTable } from './payment-run-table/data-table.js';
import { DataTableToolbar } from './payment-run-table/data-table-toolbar.js';

export function PaymentsContainer() {
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
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
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
              <PaymentRunDataTable {...list.tableProps} />
            </div>
          </section>
        </AnimateIn>
      )}

      <PaymentRunSidePanelContainer
        runId={selectedRunId}
        open={sidePanelOpen}
        onOpenChange={handleSidePanelOpenChange}
        onImportStatement={setBankStatementRunId}
      />

      <NewPaymentRunDialogContainer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onViewRun={handleViewRun}
      />

      {!!bankStatementRunId && (
        <BankStatementDialogContainer
          runId={bankStatementRunId}
          open={!!bankStatementRunId}
          onOpenChange={handleBankStatementOpenChange}
        />
      )}
    </div>
  );
}
