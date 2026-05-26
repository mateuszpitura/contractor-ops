import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

interface UseLeitwegIdDeleteDialogOptions {
  onOpenChange: (open: boolean) => void;
  id: string;
  value: string;
}

export const LEITWEG_DELETE_HEADING = 'Delete this Leitweg-ID?';
export const LEITWEG_DELETE_BODY =
  "This will remove the ID from the contractor / contract. If you re-register it later, the ID itself doesn't change — only this record. Existing invoices already using it keep their reference.";
export const LEITWEG_DELETE_BUTTON = 'Delete Leitweg-ID';

export function useLeitwegIdDeleteDialog({
  onOpenChange,
  id,
  value,
}: UseLeitwegIdDeleteDialogOptions) {
  const trpc = useTRPC();
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.leitwegId.delete.mutationOptions({
      onSuccess: () => {
        toast.success(`${LEITWEG_DELETE_BUTTON}: ${value}`);
        queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
        onOpenChange(false);
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || tErrors('Generic'));
      },
    }),
  );

  const handleConfirm = () => {
    (deleteMutation.mutate as (input: { id: string }) => void)({ id });
  };

  return {
    deleteMutation,
    isPending: deleteMutation.isPending,
    handleConfirm,
  } as const;
}
