import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseCostCenterFormSheetOptions {
  onOpenChange: (open: boolean) => void;
  onCreated?: (cc: { id: string; name: string }) => void;
}

export function useCostCenterFormSheet({ onOpenChange, onCreated }: UseCostCenterFormSheetOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.organizationDefinitions.costCenter.create.mutationOptions({
      onSuccess: created => {
        toast.success('Cost center created');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onCreated?.({ id: created.id, name: created.name });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.organizationDefinitions.costCenter.update.mutationOptions({
      onSuccess: () => {
        toast.success('Cost center updated');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const archiveMutation = useMutation(
    trpc.organizationDefinitions.costCenter.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Cost center archived');
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
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
