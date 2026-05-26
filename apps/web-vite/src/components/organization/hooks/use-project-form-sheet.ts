import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseProjectFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: { id: string; name: string }) => void;
}

export function useProjectFormSheet({ onOpenChange, onCreated }: UseProjectFormSheetOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const createMutation = useMutation(
    trpc.organizationDefinitions.project.create.mutationOptions({
      onSuccess: created => {
        toast.success('Project created');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        onCreated?.({ id: created.id, name: created.name });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.organizationDefinitions.project.update.mutationOptions({
      onSuccess: () => {
        toast.success('Project updated');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const archiveMutation = useMutation(
    trpc.organizationDefinitions.project.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Project archived');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const teams = teamsQuery.data?.items ?? [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return {
    teams,
    createMutation,
    updateMutation,
    archiveMutation,
    isSubmitting,
  } as const;
}
