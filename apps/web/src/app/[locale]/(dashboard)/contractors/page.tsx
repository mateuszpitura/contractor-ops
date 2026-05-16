'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  ContractorsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ContractorSidePanel } from '@/components/contractors/contractor-side-panel';
import type { ContractorRow } from '@/components/contractors/contractor-table/columns';
import { ContractorDataTable } from '@/components/contractors/contractor-table/data-table';
import { WizardDialog } from '@/components/contractors/contractor-wizard/wizard-dialog';
import { ImportWizardDialog } from '@/components/import/import-wizard-dialog';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
import { trpc } from '@/trpc/init';

/**
 * Inner contractor page content that uses nuqs (requires useSearchParams).
 * Wrapped in Suspense at the page level.
 */
function ContractorsContent() {
  const t = useTranslations('Contractors');
  const te = useTranslations('EmptyStates');

  const [selectedContractor, setSelectedContractor] = useState<ContractorRow | null>(null);
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

  // Lightweight count query for empty state detection
  const countQuery = useQuery(trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = (countQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = countQuery.isLoading;

  const handleRowClick = useCallback((contractor: ContractorRow) => {
    setSelectedContractor(contractor);
    setSidePanelOpen(true);
  }, []);

  const handleAddContractor = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleOpenImportWizard = useCallback(() => {
    setImportWizardOpen(true);
  }, []);

  // Atelier full-page empty state when there's truly zero data. While count
  // is in flight, fall through to the populated branch — the table renders
  // its real chrome and DataTableBody shows skeleton rows under the real
  // <TableHeader> (matches /approvals loading aesthetic). `parentLoading`
  // is forwarded so DataTableBody keeps showing skeleton rows until the
  // count query also resolves, preventing an in-table empty flash before
  // the swap to Atelier.
  if (!isCountLoading && totalCount === 0) {
    return (
      <div className="space-y-6">
        <AnimateIn delay={0}>
          <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1}>
          <AtelierEmptyState
            illustration={ContractorsIllustration}
            heading={te('contractors.heading')}
            body={te('contractors.body')}
            primaryAction={{
              label: te('contractors.cta'),
              onClick: handleAddContractor,
              icon: Plus,
            }}
            secondaryAction={{
              label: te('contractors.secondary'),
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
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      {/* Directory section */}
      <AnimateIn delay={1}>
        <section aria-label={t('pageTitle')} className="space-y-3">
          <SectionLabel icon={Users}>{t('pageTitle')}</SectionLabel>
          <ContractorDataTable
            onRowClick={handleRowClick}
            onAddContractor={handleAddContractor}
            onImport={handleOpenImportWizard}
            parentLoading={isCountLoading}
          />
        </section>
      </AnimateIn>

      {/* Side panel */}
      <ContractorSidePanel
        contractor={selectedContractor}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />

      {/* Add contractor wizard */}
      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Import wizard */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        defaultEntityType="contractor"
      />
    </div>
  );
}

/**
 * Contractor list page at /contractors.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ContractorsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractorsContent />
    </Suspense>
  );
}
