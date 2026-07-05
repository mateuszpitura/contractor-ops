import { useMutation, useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export interface TinMismatchRow {
  recipientId: string;
  recipientName: string;
  tinLast4: string | null;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
}

/**
 * The sole tRPC boundary for the staff TIN-mismatch advisory surface. The list
 * is amber advisory — escalate/resolve are the only actions; there is NO path
 * that blocks batch generation.
 */
export function useTinMismatches(taxYear: number) {
  const trpc = useTRPC();
  const query = useQuery(trpc.tax1099.listTinMismatches.queryOptions({ taxYear }));
  const escalateMutation = useMutation(trpc.tax1099.escalateMismatch.mutationOptions());
  const resolveMutation = useMutation(trpc.tax1099.resolveMismatch.mutationOptions());

  const mismatches = (query.data ?? []) as TinMismatchRow[];

  return {
    isPending: query.isPending,
    error: query.error ?? null,
    isEmpty: !(query.isPending || query.error) && mismatches.length === 0,
    mismatches,
    escalate: async (recipientId: string) => {
      await escalateMutation.mutateAsync({ recipientId, taxYear });
      await query.refetch();
    },
    resolve: async (recipientId: string) => {
      await resolveMutation.mutateAsync({ recipientId, taxYear });
      await query.refetch();
    },
    isMutating: escalateMutation.isPending || resolveMutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  } as const;
}
