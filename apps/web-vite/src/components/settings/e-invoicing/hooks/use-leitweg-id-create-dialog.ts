import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { LeitwegIdEditInitial } from '../leitweg-id-create-dialog.js';

interface ContractorLite {
  id: string;
  displayName: string | null;
}

function extractContractors(data: unknown): ContractorLite[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ContractorLite[];
  const container = data as { contractors?: unknown; items?: unknown; rows?: unknown };
  for (const key of ['contractors', 'items', 'rows'] as const) {
    const v = container[key];
    if (Array.isArray(v)) return v as ContractorLite[];
  }
  return [];
}

export type LeitwegIdSavePayload = {
  value: string;
  description: string | undefined;
  contractorId: string | null;
  contractId: string | null;
  isDefaultForContractor: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
};

interface UseLeitwegIdCreateDialogOptions {
  onOpenChange: (open: boolean) => void;
  initial?: LeitwegIdEditInitial | null;
  onSaved?: (id: string) => void;
  setFormError: (error: string | null) => void;
}

export function useLeitwegIdCreateDialog({
  onOpenChange,
  initial,
  onSaved,
  setFormError,
}: UseLeitwegIdCreateDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.LeitwegIdDialog');
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();

  const contractorsQuery = useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 100,
      sortBy: 'displayName',
      sortOrder: 'asc',
      filters: {},
    } as never),
  );
  const contractors = extractContractors(contractorsQuery.data);

  const handleMutationError = (err: { message?: string }) => {
    const msg = err.message ?? '';
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('conflict')) {
      setFormError(t('errorDuplicate'));
    } else {
      setFormError(msg || tErrors('Generic'));
    }
    toast.error(err.message);
  };

  const createMutation = useMutation(
    trpc.leitwegId.create.mutationOptions({
      onSuccess: (row: unknown) => {
        toast.success(t('saveButton'));
        queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
        const rowId = (row as { id?: string } | null)?.id;
        if (rowId) onSaved?.(rowId);
        onOpenChange(false);
      },
      onError: handleMutationError,
    }),
  );

  const updateMutation = useMutation(
    trpc.leitwegId.update.mutationOptions({
      onSuccess: (row: unknown) => {
        toast.success(t('saveButton'));
        queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
        const rowId = (row as { id?: string } | null)?.id ?? initial?.id;
        if (rowId) onSaved?.(rowId);
        onOpenChange(false);
      },
      onError: handleMutationError,
    }),
  );

  const save = (payload: LeitwegIdSavePayload, isEdit: boolean) => {
    setFormError(null);
    if (isEdit && initial) {
      (updateMutation.mutate as (input: { id: string } & LeitwegIdSavePayload) => void)({
        id: initial.id,
        ...payload,
      });
    } else {
      (createMutation.mutate as (input: LeitwegIdSavePayload) => void)(payload);
    }
  };

  return {
    t,
    contractors,
    save,
    isPending: createMutation.isPending || updateMutation.isPending,
  } as const;
}
