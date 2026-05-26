import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type ApprovalChainStep = {
  name: string;
  approverUserId: string | null | undefined;
  approverRole: string | null | undefined;
  slaHours: number;
  required: boolean;
};

export type ResolvedApprovalChain = {
  name: string;
  stepsJson: ApprovalChainStep[] | unknown;
};

export function useApprovalChain(chainConfigId: string | null | undefined, enabled = true) {
  const trpc = useTRPC();

  const chainQuery = useQuery({
    ...trpc.approval.getChain.queryOptions({ id: chainConfigId ?? '' }),
    enabled: !!chainConfigId && enabled,
  });

  const chain = chainQuery.data as ResolvedApprovalChain | undefined;
  const steps: ApprovalChainStep[] = Array.isArray(chain?.stepsJson)
    ? (chain.stepsJson as ApprovalChainStep[])
    : [];

  return {
    chain,
    steps,
    isLoading: chainQuery.isLoading,
  } as const;
}
