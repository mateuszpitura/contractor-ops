'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  ContractsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ContractSidePanel } from '@/components/contracts/contract-side-panel';
import type { ContractRow } from '@/components/contracts/contract-table/columns';
import { ContractDataTable } from '@/components/contracts/contract-table/data-table';
import { ContractWizardDialog } from '@/components/contracts/contract-wizard/wizard-dialog';
import { ImportWizardDialog } from '@/components/import/import-wizard-dialog';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
import { trpc } from '@/trpc/init';

/**
 * Inner contract page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractsContent() {
  const t = useTranslations('Contracts');
  const te = useTranslations('EmptyStates');

  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [action, setAction] = useQueryState('action', parseAsString);

  useEffect(() => {
    if (action === 'new') {
      setWizardOpen(true);
      void setAction(null);
    }
  }, [action, setAction]);

  // Check contract and contractor counts for empty state
  const contractCountQuery = useQuery(trpc.contract.list.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const contractTotal =
    (contractCountQuery.data as { totalCount: number } | undefined)?.totalCount ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = contractCountQuery.isLoading;

  const handleRowClick = useCallback((contract: ContractRow) => {
    setSelectedContract(contract);
    setSidePanelOpen(true);
  }, []);

  const handleNewContract = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleOpenImportWizard = useCallback(() => {
    setImportWizardOpen(true);
  }, []);

  // Atelier full-page empty state only after count resolves AND there's truly
  // zero data. While count is in flight, fall through to the populated
  // branch — ContractDataTable renders its real chrome and DataTableBody
  // shows skeleton rows. `parentLoading` is forwarded to prevent an
  // in-table empty flash before the swap to Atelier.
  if (!isCountLoading && contractTotal === 0) {
    return (
      <div className="space-y-6">
        <AnimateIn delay={0}>
          <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1}>
          <AtelierEmptyState
            illustration={ContractsIllustration}
            heading={te('contracts.heading')}
            body={te('contracts.body')}
            primaryAction={{ label: te('contracts.cta'), onClick: handleNewContract }}
            prerequisiteMissing={contractorCount === 0}
            prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      {/* Contracts section */}
      <AnimateIn delay={1}>
        <section aria-label={t('pageTitle')} className="space-y-3">
          <SectionLabel icon={FileText}>{t('pageTitle')}</SectionLabel>
          <ContractDataTable
            onRowClick={handleRowClick}
            onNewContract={handleNewContract}
            onImport={handleOpenImportWizard}
            parentLoading={isCountLoading}
          />
        </section>
      </AnimateIn>

      {/* Side panel */}
      <ContractSidePanel
        contract={selectedContract}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      {/* Contract wizard */}
      <ContractWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Import wizard */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contract"
      />
    </div>
  );
}

/**
 * Contract list page at /contracts.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ContractsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractsContent />
    </Suspense>
  );
}
