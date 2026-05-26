import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseTeamFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (team: { id: string; name: string }) => void;
}

export function useTeamFormSheet({ onOpenChange, onCreated }: UseTeamFormSheetOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.organizationDefinitions.team.create.mutationOptions({
      onSuccess: created => {
        toast.success('Team created');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onCreated?.({ id: created.id, name: created.name });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.organizationDefinitions.team.update.mutationOptions({
      onSuccess: () => {
        toast.success('Team updated');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const archiveMutation = useMutation(
    trpc.organizationDefinitions.team.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Team archived');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.team.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return {
    createMutation,
    updateMutation,
    archiveMutation,
    isSubmitting,
  } as const;
}
