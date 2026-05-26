import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useCostCenterCsvImport(onOpenChange: (open: boolean) => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const importMutation = useMutation(
    trpc.organizationDefinitions.costCenter.importCsv.mutationOptions({
      onSuccess: result => {
        toast.success(`Imported ${result.inserted} cost centers`);
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.costCenter.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const importRows = (rows: { name: string; code: string }[]) => {
    importMutation.mutate({ rows });
  };

  return {
    importMutation,
    importRows,
  } as const;
}
