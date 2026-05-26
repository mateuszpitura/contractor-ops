import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useContractDetail(contractId: string) {
  const trpc = useTRPC();

  const contractQuery = useQuery(trpc.contract.getById.queryOptions({ id: contractId }));
  const contract = contractQuery.data;

  useBreadcrumbOverride(contractId, contract?.title);

  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const esignConnections = (connectionsQuery.data ?? []) as unknown[];

  const envelopesQuery = useQuery(
    trpc.esign.listEnvelopes.queryOptions({ contractId }, { enabled: !!contractId }),
  );
  const envelopes = (envelopesQuery.data ?? []) as Array<{ status: string }>;
  const activeEnvelope = envelopes.find(e => ['SENT', 'DELIVERED', 'CREATED'].includes(e.status));

  const handleRetry = useCallback(() => {
    void contractQuery.refetch();
  }, [contractQuery]);

  const isNotFound =
    contractQuery.isError &&
    (contractQuery.error?.message?.includes('not found') ||
      (contractQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND');

  return {
    contract,
    contractQuery,
    esignConnections,
    activeEnvelope,
    handleRetry,
    isNotFound,
    isLoading: contractQuery.isLoading,
    isError: contractQuery.isError,
  } as const;
}
