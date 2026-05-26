import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseProjectFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: { id: string; name: string }) => void;
}

export function useProjectFormSheet({ onOpenChange, onCreated }: UseProjectFormSheetOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const createMutation = useMutation(
    trpc.organizationDefinitions.project.create.mutationOptions({
      onSuccess: created => {
        toast.success(toasts.projectCreated());
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
        toast.success(toasts.projectUpdated());
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
        toast.success(toasts.projectArchived());
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
