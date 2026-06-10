import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useCostCenterCsvImport(onOpenChange: (open: boolean) => void) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const importMutation = useResourceMutation(
    trpc.organizationDefinitions.costCenter.importCsv.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
      },
    }),
    {
      invalidate: [trpc.organizationDefinitions.costCenter.list.queryKey()],
      successMessage: toasts.done(),
    },
  );

  const importRows = useCallback(
    (rows: { name: string; code: string }[]) => {
      importMutation.mutate({ rows });
    },
    [importMutation],
  );

  return {
    importMutation,
    importRows,
  } as const;
}
