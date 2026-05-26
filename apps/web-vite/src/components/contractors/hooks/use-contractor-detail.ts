import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useContractorDetail(contractorId: string) {
  const trpc = useTRPC();
  const t = useTranslations('ContractorProfile');

  const contractorQuery = useQuery({
    ...trpc.contractor.getById.queryOptions({ id: contractorId }),
    enabled: Boolean(contractorId),
  });

  const contractor = contractorQuery.data;

  useBreadcrumbOverride(contractorId, contractor?.displayName);

  const handleRetry = useCallback(() => {
    void contractorQuery.refetch();
  }, [contractorQuery]);

  const isNotFound =
    contractorQuery.isError &&
    (contractorQuery.error?.message?.includes('not found') ||
      (contractorQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND');

  return {
    contractorId,
    contractor,
    contractorQuery,
    t,
    handleRetry,
    isNotFound,
    isLoading: contractorQuery.isLoading,
    isError: contractorQuery.isError,
  } as const;
}
