import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseCostCenterFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (cc: { id: string; name: string }) => void;
}

export function useCostCenterFormSheet({ onOpenChange, onCreated }: UseCostCenterFormSheetOptions) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const createMutation = useResourceMutation(
    trpc.organizationDefinitions.costCenter.create.mutationOptions({
      onSuccess: created => {
        onCreated?.({ id: created.id, name: created.name });
      },
    }),
    {
      successMessage: toasts.costCenterCreated(),
      invalidate: [trpc.organizationDefinitions.costCenter.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const updateMutation = useResourceMutation(
    trpc.organizationDefinitions.costCenter.update.mutationOptions(),
    {
      successMessage: toasts.costCenterUpdated(),
      invalidate: [trpc.organizationDefinitions.costCenter.list.queryKey()],
      onClose: () => onOpenChange(false),
    },
  );

  const archiveMutation = useResourceMutation(
    trpc.organizationDefinitions.costCenter.archive.mutationOptions(),
    {
      successMessage: toasts.costCenterArchived(),
      invalidate: [trpc.organizationDefinitions.costCenter.list.queryKey()],
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
