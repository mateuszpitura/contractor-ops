import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

interface UsePeppolParticipantDeregisterDialogOptions {
  onOpenChange: (open: boolean) => void;
}

export function usePeppolParticipantDeregisterDialog({
  onOpenChange,
}: UsePeppolParticipantDeregisterDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.PeppolDialog');
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation(
    trpc.peppol.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('deregisterButton'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.listParticipants.queryKey(),
        });
        queryClient.invalidateQueries({ queryKey: trpc.peppol.getStatus.queryKey() });
        onOpenChange(false);
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || tErrors('Generic'));
      },
    }),
  );

  const handleConfirm = () => {
    (disconnectMutation.mutate as () => void)();
  };

  return {
    t,
    isPending: disconnectMutation.isPending,
    handleConfirm,
  } as const;
}
