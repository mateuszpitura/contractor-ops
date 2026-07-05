import { useMutation, useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export type Form1099Status = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';

export interface Form1099Row {
  id: string;
  recipientId: string;
  taxYear: number;
  status: Form1099Status;
  corrected: boolean;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  cfsfStateCode: string | null;
  currency: string;
  pdfArchiveKey: string | null;
  createdAt: string | Date;
  recipient: { legalName: string; ssnLast4: string | null };
}

export interface GenerateBatchResult {
  taxYear: number;
  idempotent: boolean;
  generatedCount: number;
  suppressedCount: number;
}

/**
 * The sole tRPC boundary for the staff 1099-NEC batch surface. Reads the filed
 * batch rows (never a full TIN — last-4 only) and exposes the review-before-file
 * generate action. The batch panel stays presentational and branches on this
 * hook's state.
 */
export function useTax1099Batch(taxYear: number) {
  const trpc = useTRPC();
  const query = useQuery(trpc.tax1099.list.queryOptions({ taxYear }));
  const generateMutation = useMutation(trpc.tax1099.generateBatch.mutationOptions());

  const forms = (query.data ?? []) as Form1099Row[];
  const active = forms.filter(f => f.status === 'ACTIVE');

  return {
    isPending: query.isPending,
    error: query.error ?? null,
    isEmpty: !(query.isPending || query.error) && active.length === 0,
    forms: active,
    generatedCount: active.length,
    generate: async (): Promise<GenerateBatchResult> => {
      const result = (await generateMutation.mutateAsync({ taxYear })) as GenerateBatchResult;
      await query.refetch();
      return result;
    },
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error ?? null,
    lastResult: (generateMutation.data ?? null) as GenerateBatchResult | null,
    refetch: () => {
      void query.refetch();
    },
  } as const;
}
