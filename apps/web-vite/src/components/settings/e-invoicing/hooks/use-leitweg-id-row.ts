import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { LeitwegIdEditInitial } from '../leitweg-id-create-dialog.js';
import type { LeitwegIdRowData } from '../leitweg-id-row.js';

export function useLeitwegIdRow(row: LeitwegIdRowData) {
  const trpc = useTRPC();
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setDefaultMutation = useMutation(
    trpc.leitwegId.setDefault.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
        toast.success('Done.');
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || tErrors('Generic'));
      },
    }),
  );

  const editInitial: LeitwegIdEditInitial = {
    id: row.id,
    value: row.value,
    description: row.description ?? null,
    contractorId: row.contractorId ?? null,
    contractId: row.contractId ?? null,
    isDefaultForContractor: row.isDefaultForContractor,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    notes: row.notes ?? null,
  };

  const handleSetDefault = () => {
    (setDefaultMutation.mutate as (input: { id: string }) => void)({ id: row.id });
  };

  return {
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    editInitial,
    setDefaultMutation,
    isSetDefaultPending: setDefaultMutation.isPending,
    handleSetDefault,
  } as const;
}
