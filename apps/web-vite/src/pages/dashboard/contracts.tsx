/**
 * Contracts list — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  ContractsIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { FileText, Plus, Users } from 'lucide-react';
import { Suspense } from 'react';

import { ContractSidePanel } from '../../components/contracts/contract-side-panel.js';
import { ContractDataTable } from '../../components/contracts/contract-table/data-table.js';
import { DataTableToolbar } from '../../components/contracts/contract-table/data-table-toolbar.js';
import { ContractWizardDialog } from '../../components/contracts/contract-wizard/wizard-dialog.js';
import { useContractsListPage } from '../../components/contracts/hooks/use-contracts-list-page.js';
import { ImportWizardDialog } from '../../components/import/import-wizard-dialog.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function ContractsListPageContent() {
  const t = useTranslations('Contracts');
  const {
    list,
    selectedContract,
    sidePanelOpen,
    setSidePanelOpen,
    wizardOpen,
    setWizardOpen,
    importWizardOpen,
    setImportWizardOpen,
    openWizard,
    openImportWizard,
    handleRowClick,
  } = useContractsListPage();

  if (list.showEmptyState) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
        <AnimateIn delay={0}>
          <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
          <AtelierEmptyState
            illustration={ContractsIllustration}
            heading={list.emptyProps.heading}
            body={list.emptyProps.body}
            primaryAction={{
              label: list.emptyProps.cta,
              onClick: openWizard,
              icon: Plus,
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
        <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <section aria-label={t('pageTitle')} className={WORKBENCH_TABLE_SECTION_CLASS}>
          <SectionLabel icon={FileText}>{t('pageTitle')}</SectionLabel>
          <ContractDataTable
            {...list.tableProps}
            onRowClick={handleRowClick}
            onNewContract={openWizard}
            onImport={openImportWizard}
            parentLoading={list.isCountLoading}
            toolbar={<DataTableToolbar {...list.toolbarProps} />}
            sectionClassName=""
          />
        </section>
      </AnimateIn>

      <ContractSidePanel
        contract={selectedContract}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contract"
      />
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractsListPageContent />
    </Suspense>
  );
}
