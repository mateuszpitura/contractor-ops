import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useIr35ChainPanel(engagementId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const listQuery = useQuery(
    trpc.ir35Chain.listByEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  const markDelivered = useResourceMutation(trpc.ir35Chain.markDelivered.mutationOptions(), {
    invalidate: [trpc.ir35Chain.pathFilter()],
    successMessage: toasts.done(),
  });

  const markAcknowledged = useResourceMutation(trpc.ir35Chain.markAcknowledged.mutationOptions(), {
    invalidate: [trpc.ir35Chain.pathFilter()],
    successMessage: toasts.done(),
  });

  const removeParticipant = useResourceMutation(
    trpc.ir35Chain.removeParticipant.mutationOptions(),
    {
      invalidate: [trpc.ir35Chain.pathFilter()],
      successMessage: toasts.done(),
    },
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
  const toasts = useCommonToasts();

  const mutation = useResourceMutation(trpc.ir35Chain.upsertParticipant.mutationOptions(), {
    invalidate: [trpc.ir35Chain.pathFilter()],
    successMessage: toasts.done(),
    onClose: () => onOpenChange(false),
  });

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
