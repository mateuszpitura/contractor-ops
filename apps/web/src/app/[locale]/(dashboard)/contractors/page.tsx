'use client';

import { AtelierEmptyState, AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
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

  // Show empty state only when count query resolved and total is 0
  if (!isCountLoading && totalCount === 0) {
    return (
      <div className="space-y-6">
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
        <AtelierEmptyState
          icon={Users}
          heading={te('contractors.heading')}
          body={te('contractors.body')}
          primaryAction={{ label: te('contractors.cta'), onClick: handleAddContractor }}
          secondaryAction={{
            label: te('contractors.secondary'),
            onClick: handleOpenImportWizard,
          }}
          renderAction={renderEmptyStateAction}
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
 * Fallback loading state while Suspense boundary resolves.
 */
function ContractorsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              key={`skel-${i}`}
              className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Contractor list page at /contractors.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ContractorsPage() {
  return (
    <Suspense fallback={<ContractorsLoading />}>
      <ContractorsContent />
    </Suspense>
  );
}
