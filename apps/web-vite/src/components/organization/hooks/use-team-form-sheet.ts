import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseTeamFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (team: { id: string; name: string }) => void;
}

export function useTeamFormSheet({ onOpenChange, onCreated }: UseTeamFormSheetOptions) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const createMutation = useResourceMutation(
    trpc.organizationDefinitions.team.create.mutationOptions({
      onSuccess: created => {
        onCreated?.({ id: created.id, name: created.name });
      },
    }),
    {
      successMessage: toasts.teamCreated(),
      invalidate: [trpc.organizationDefinitions.team.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const updateMutation = useResourceMutation(
    trpc.organizationDefinitions.team.update.mutationOptions(),
    {
      successMessage: toasts.teamUpdated(),
      invalidate: [trpc.organizationDefinitions.team.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const archiveMutation = useResourceMutation(
    trpc.organizationDefinitions.team.archive.mutationOptions(),
    {
      successMessage: toasts.teamArchived(),
      invalidate: [trpc.organizationDefinitions.team.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return {
    createMutation,
    updateMutation,
    archiveMutation,
    isSubmitting,
  } as const;
}
