import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useIr35ChainPanel(engagementId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.ir35Chain.listByEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['ir35Chain', 'listByEngagement']] });
  }, [queryClient]);

  const markDelivered = useMutation(
    trpc.ir35Chain.markDelivered.mutationOptions({
      onSuccess: () => {
        invalidateList();
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const markAcknowledged = useMutation(
    trpc.ir35Chain.markAcknowledged.mutationOptions({
      onSuccess: () => {
        invalidateList();
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const removeParticipant = useMutation(
    trpc.ir35Chain.removeParticipant.mutationOptions({
      onSuccess: () => {
        invalidateList();
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    listQuery,
    rows: listQuery.data ?? [],
    markDelivered,
    markAcknowledged,
    removeParticipant,
  } as const;
}

export function useAddIr35Participant(
  engagementId: string,
  nextOrderIndex: number,
  onOpenChange: (next: boolean) => void,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.ir35Chain.upsertParticipant.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        void queryClient.invalidateQueries({ queryKey: [['ir35Chain', 'listByEngagement']] });
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const addParticipant = useCallback(
    (params: { role: 'AGENCY' | 'PSC'; displayName: string; contactEmail: string | null }) => {
      mutation.mutate({
        contractorAssignmentId: engagementId,
        role: params.role,
        orderIndex: nextOrderIndex,
        displayName: params.displayName,
        contactEmail: params.contactEmail,
      });
    },
    [mutation, engagementId, nextOrderIndex],
  );

  return { mutation, addParticipant, isPending: mutation.isPending } as const;
}
