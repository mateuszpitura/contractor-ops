'use client';

import { AtelierEmptyState, AtelierPageHeader, ContractsIllustration } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ContractCard, ContractCardSkeleton } from '@/components/portal/contract-card';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { portalTrpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal contracts list page.
 *
 * Per UI-SPEC Contracts List and PORT-02:
 * - Card grid (2 cols desktop, 1 col mobile)
 * - ContractCard for each contract
 * - Loading: 4 card skeletons
 * - Empty state with specific copy from UI-SPEC
 */
export default function PortalContractsPage() {
  const t = useTranslations('Portal');
  const contractsQuery = useQuery(portalTrpc.portal.listContracts.queryOptions());
  const contracts = contractsQuery.data;
  const isLoading = contractsQuery.isPending;

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('contracts.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ContractCardSkeleton />
            <ContractCardSkeleton />
            <ContractCardSkeleton />
            <ContractCardSkeleton />
          </div>
        ) : contracts && contracts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {contracts.map(contract => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <AtelierEmptyState
            illustration={ContractsIllustration}
            heading={t('contracts.emptyTitle')}
            body={t('contracts.emptyBody')}
            renderAction={renderEmptyStateAction}
          />
        )}
      </AnimateIn>
    </div>
  );
}
