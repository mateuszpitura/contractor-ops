import { useCallback, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    currentFallbackApproverId ?? undefined,
  );

  const setFallbackMutation = useResourceMutation(
    trpc.teams.setFallbackApprover.mutationOptions(),
    {
      successMessage: t('toast.saved'),
      invalidate: [trpc.teams.pathFilter()],
      onClose: () => onOpenChange(false),
    },
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
