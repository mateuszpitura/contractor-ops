import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface UseTeamsFallbackApproverDialogParams {
  teamId: string;
  currentFallbackApproverId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useTeamsFallbackApproverDialog({
  teamId,
  currentFallbackApproverId,
  open,
  onOpenChange,
}: UseTeamsFallbackApproverDialogParams) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.teams.fallbackApprover');
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    currentFallbackApproverId ?? undefined,
  );

  const setFallbackMutation = useMutation(
    trpc.teams.setFallbackApprover.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(trpc.teams.pathFilter());
        onOpenChange(false);
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const handleSave = useCallback(() => {
    if (!selectedUserId) return;
    setFallbackMutation.mutate({ teamId, fallbackApproverId: selectedUserId });
  }, [selectedUserId, setFallbackMutation, teamId]);

  const handleClear = useCallback(() => {
    setFallbackMutation.mutate({ teamId, fallbackApproverId: null });
  }, [setFallbackMutation, teamId]);

  return {
    open,
    onOpenChange,
    selectedUserId,
    setSelectedUserId,
    currentFallbackApproverId,
    setFallbackMutation,
    handleSave,
    handleClear,
    t,
  } as const;
}
