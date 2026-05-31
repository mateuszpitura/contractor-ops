import { AtelierEmptyState, ContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { ContractCard, ContractCardSkeleton } from './contract-card.js';
import { usePortalContracts } from './hooks/use-portal-contracts.js';

export function PortalContractsContainer() {
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
