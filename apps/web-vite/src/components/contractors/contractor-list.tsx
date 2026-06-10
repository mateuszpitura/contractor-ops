import {
  AtelierEmptyState,
  ContractorsIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Plus, Upload, Users } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ImportWizardDialog } from '../import/import-wizard-dialog.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { ContractorSidePanel } from './contractor-side-panel.js';
import type { ContractorRow } from './contractor-table/columns.js';
import { ContractorDataTable } from './contractor-table/data-table.js';
import { DataTableToolbar } from './contractor-table/data-table-toolbar.js';
import { WizardDialog } from './contractor-wizard/wizard-dialog.js';
import { useContractorList } from './hooks/use-contractor-list.js';

export function ContractorListContainer() {
  const t = useTranslations('Contractors');

  const [selectedContractor, setSelectedContractor] = useState<ContractorRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [action, setAction] = useQueryState('action', parseAsString);

  const handleAddContractor = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleOpenImportWizard = useCallback(() => {
    setImportWizardOpen(true);
  }, []);

  const list = useContractorList({
    onAddContractor: handleAddContractor,
    onImport: handleOpenImportWizard,
  });

  useEffect(() => {
    if (action === 'new') {
      setWizardOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  const handleRowClick = useCallback((contractor: ContractorRow) => {
    setSelectedContractor(contractor);
    setSidePanelOpen(true);
  }, []);

  if (list.showEmptyState) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
        <AnimateIn delay={0}>
          <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
          <AtelierEmptyState
            illustration={ContractorsIllustration}
            heading={list.emptyProps.heading}
            body={list.emptyProps.body}
            primaryAction={{
              label: list.emptyProps.cta,
              onClick: handleAddContractor,
              icon: Plus,
            }}
            secondaryAction={{
              label: list.emptyProps.secondary,
              onClick: handleOpenImportWizard,
              icon: Upload,
            }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
        <ImportWizardDialog
          open={importWizardOpen}
          onOpenChange={setImportWizardOpen}
          defaultEntityType="contractor"
        />
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
          <SectionLabel icon={Users}>{t('pageTitle')}</SectionLabel>
          <ContractorDataTable
            {...list.tableProps}
            onRowClick={handleRowClick}
            onAddContractor={handleAddContractor}
            onImport={handleOpenImportWizard}
            parentLoading={list.isCountLoading}
            toolbar={<DataTableToolbar {...list.toolbarProps} />}
            sectionClassName=""
          />
        </section>
      </AnimateIn>

      <ContractorSidePanel
        contractor={selectedContractor}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contractor"
      />
    </div>
  );
}

/** @deprecated Use ContractorList */
export { ContractorListContainer as ContractorList };
