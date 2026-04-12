'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ContractCard, ContractCardSkeleton } from '@/components/portal/contract-card';
import { EmptyState } from '@/components/shared/empty-state';
import { trpc } from '@/trpc/init';

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
  const contractsQuery = useQuery(trpc.portal.listContracts.queryOptions());
  const contracts = contractsQuery.data;
  const isLoading = contractsQuery.isPending;

  return (
    <div>
      <h1 className="text-xl font-semibold">{t('contracts.title')}</h1>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ContractCardSkeleton />
          <ContractCardSkeleton />
          <ContractCardSkeleton />
          <ContractCardSkeleton />
        </div>
      ) : contracts && contracts.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {contracts.map(contract => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          heading={t('contracts.emptyTitle')}
          body={t('contracts.emptyBody')}
        />
      )}
    </div>
  );
}
