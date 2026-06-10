import { useQuery } from '@tanstack/react-query';
import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useContractDetail(contractId: string) {
  const trpc = useTRPC();

  const {
    query: contractQuery,
    data: contract,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery(trpc.contract.getById.queryOptions({ id: contractId }));

  useBreadcrumbOverride(contractId, contract?.title);

  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const esignConnections = connectionsQuery.data ?? [];

  const envelopesQuery = useQuery(
    trpc.esign.listEnvelopes.queryOptions({ contractId }, { enabled: !!contractId }),
  );
  const envelopes = envelopesQuery.data ?? [];
  const activeEnvelope = envelopes.find(e => ['SENT', 'DELIVERED', 'CREATED'].includes(e.status));

  return {
    contract,
    contractQuery,
    esignConnections,
    activeEnvelope,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } as const;
}
