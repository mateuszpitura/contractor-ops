/**
 * Portal contracts list — route shell with inlined page content.
 */

import { AtelierEmptyState, ContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { ContractCard, ContractCardSkeleton } from '../../components/portal/contract-card.js';
import { usePortalContracts } from '../../components/portal/hooks/use-portal-contracts.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function PortalContractsPageContent() {
  const t = useTranslations('Portal');
  const { contracts, isLoading } = usePortalContracts();

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ContractCardSkeleton />
        <ContractCardSkeleton />
        <ContractCardSkeleton />
        <ContractCardSkeleton />
      </div>
    );
  } else if (contracts && contracts.length > 0) {
    body = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {contracts.map(contract => (
          <ContractCard key={contract.id} contract={contract} />
        ))}
      </div>
    );
  } else {
    body = (
      <AtelierEmptyState
        illustration={ContractsIllustration}
        heading={t('contracts.emptyTitle')}
        body={t('contracts.emptyBody')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('contracts.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('contracts.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>{body}</AnimateIn>
    </div>
  );
}

export default function PortalContractsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalContractsPageContent />
    </Suspense>
  );
}
