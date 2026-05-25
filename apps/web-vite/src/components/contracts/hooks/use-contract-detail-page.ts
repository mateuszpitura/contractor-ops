import { useParams } from 'react-router-dom';

import { useContractDetail } from './use-contract-detail.js';

type ContractParty = {
  name: string;
  email: string;
  role: 'signer' | 'countersigner';
};

/**
 * Drives the contract detail page: resolves the route param, fetches the
 * contract + e-sign state via `useContractDetail`, and derives the
 * `contractParties` view-model passed down to header + tabs.
 */
export function useContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = params.id ?? '';

  const detail = useContractDetail(contractId);

  const contractParties: ContractParty[] = detail.contract?.contractor
    ? [
        {
          name: detail.contract.contractor.displayName,
          email: '',
          role: 'signer' as const,
        },
      ]
    : [];

  return {
    contractId,
    contract: detail.contract,
    esignConnections: detail.esignConnections,
    activeEnvelope: detail.activeEnvelope,
    handleRetry: detail.handleRetry,
    isNotFound: detail.isNotFound,
    isError: detail.isError,
    isLoading: detail.isLoading,
    contractParties,
  } as const;
}
