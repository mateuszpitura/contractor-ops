import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ComplianceHeldRow = {
  approvalFlowId: string;
  resourceId: string;
  heldAt: string | null;
  heldItemIds: string[];
  heldByOperator: string | null;
  lastApprover: { id: string; name: string | null; email: string | null } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalMinor: number;
    currency: string;
    contractor: { id: string; legalName: string } | null;
  } | null;
};

export function useComplianceHeldApprovals(tab: 'my' | 'all') {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Approvals.complianceHold');

  const query = useQuery({
    ...trpc.approval.listComplianceHeld.queryOptions({ tab }),
    refetchInterval: 30000,
  });

  const items = (query.data?.items ?? []) as ComplianceHeldRow[];

  const [resumeTarget, setResumeTarget] = useState<ComplianceHeldRow | null>(null);
  const [resumeReason, setResumeReason] = useState('');

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries(trpc.approval.listComplianceHeld.pathFilter());
    void queryClient.invalidateQueries({ queryKey: [['approval', 'listPending']] });
    void queryClient.invalidateQueries({ queryKey: [['approval', 'actionableCount']] });
  }, [queryClient, trpc.approval.listComplianceHeld]);

  const resumeMutation = useResourceMutation(
    {
      ...trpc.approval.resumeFromCompliance.mutationOptions(),
      onSuccess: () => {
        setResumeTarget(null);
        setResumeReason('');
        invalidate();
      },
    },
    {
      successMessage: t('toast.resumed'),
    },
  );

  const openResume = useCallback((row: ComplianceHeldRow) => {
    setResumeTarget(row);
    setResumeReason('');
  }, []);

  const closeResume = useCallback(() => {
    setResumeTarget(null);
    setResumeReason('');
  }, []);

  const submitResume = useCallback(() => {
    if (!resumeTarget || resumeReason.trim().length < 1) return;
    resumeMutation.mutate({
      approvalFlowId: resumeTarget.approvalFlowId,
      reason: resumeReason.trim(),
    });
  }, [resumeMutation, resumeReason, resumeTarget]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    onRetry: () => void query.refetch(),
    resumeTarget,
    resumeReason,
    setResumeReason,
    openResume,
    closeResume,
    submitResume,
    isResuming: resumeMutation.isPending,
  } as const;
}
