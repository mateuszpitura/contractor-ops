import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useContractorDetail(contractorId: string) {
  const trpc = useTRPC();
  const t = useTranslations('ContractorProfile');

  const {
    query: contractorQuery,
    data: contractor,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery({
    ...trpc.contractor.getById.queryOptions({ id: contractorId }),
    enabled: Boolean(contractorId),
  });

  useBreadcrumbOverride(contractorId, contractor?.displayName);

  return {
    contractorId,
    contractor,
    contractorQuery,
    t,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } as const;
}
