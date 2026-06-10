import { useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseProjectFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: { id: string; name: string }) => void;
}

export function useProjectFormSheet({ onOpenChange, onCreated }: UseProjectFormSheetOptions) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const createMutation = useResourceMutation(
    trpc.organizationDefinitions.project.create.mutationOptions({
      onSuccess: created => {
        onCreated?.({ id: created.id, name: created.name });
      },
    }),
    {
      successMessage: toasts.projectCreated(),
      invalidate: [trpc.organizationDefinitions.project.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const updateMutation = useResourceMutation(
    trpc.organizationDefinitions.project.update.mutationOptions(),
    {
      successMessage: toasts.projectUpdated(),
      invalidate: [trpc.organizationDefinitions.project.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const archiveMutation = useResourceMutation(
    trpc.organizationDefinitions.project.archive.mutationOptions(),
    {
      successMessage: toasts.projectArchived(),
      invalidate: [trpc.organizationDefinitions.project.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
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
