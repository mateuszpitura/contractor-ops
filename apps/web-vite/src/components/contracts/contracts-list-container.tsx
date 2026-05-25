import {
  AtelierEmptyState,
  AtelierPageHeader,
  ContractsIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { FileText, Plus, Users } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { ImportWizardDialogContainer } from '../import/import-wizard-dialog-container.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { ContractSidePanel } from './contract-side-panel.js';
import { ContractDataTable } from './contract-table/data-table.js';
import { DataTableToolbar } from './contract-table/data-table-toolbar.js';
import { ContractWizardDialogContainer } from './contract-wizard/wizard-dialog-container.js';
import { useContractsListPage } from './hooks/use-contracts-list-page.js';

export function ContractsListContainer() {
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
      <div className="space-y-6">
        <AnimateIn delay={0}>
          <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1}>
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
        <ContractWizardDialogContainer open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
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
          />
        </section>
      </AnimateIn>

      <ContractSidePanel
        contract={selectedContract}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      <ContractWizardDialogContainer open={wizardOpen} onOpenChange={setWizardOpen} />

      <ImportWizardDialogContainer
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contract"
      />
    </div>
  );
}
