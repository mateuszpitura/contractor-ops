import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useAddAmendmentDialog(
  contractId: string,
  _open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const t = useTranslations('ContractDetail.amendments');
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [title, setTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation(
    trpc.contract.createAmendment.mutationOptions({
      onSuccess: () => {
        toast.success(t('addSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.contract.listAmendments.queryKey(),
        });
        onOpenChange(false);
        setTitle('');
        setEffectiveDate('');
        setDescription('');
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || t('addError'));
      },
    }),
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!(title.trim() && effectiveDate)) return;

      createMutation.mutate({
        contractId,
        title: title.trim(),
        effectiveDate: new Date(effectiveDate).toISOString(),
        description: description.trim() || undefined,
        changesSummaryJson: {},
      });
    },
    [contractId, createMutation, description, effectiveDate, title],
  );

  return {
    description,
    effectiveDate,
    handleSubmit,
    isPending: createMutation.isPending,
    setDescription,
    setEffectiveDate,
    setTitle,
    title,
  } as const;
}

export function useContractAmendmentsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = useCallback(() => setDialogOpen(true), []);

  return {
    dialogOpen,
    openDialog,
    setDialogOpen,
  } as const;
}
