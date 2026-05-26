import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

const ASP_PROVIDER_DEFAULT = 'storecove' as const;
const ENVIRONMENT_DEFAULT = 'sandbox' as const;

interface UsePeppolParticipantRegisterDialogOptions {
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}

export function usePeppolParticipantRegisterDialog({
  onOpenChange,
  onReset,
}: UsePeppolParticipantRegisterDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.PeppolDialog');
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();

  const connectMutation = useMutation(
    trpc.peppol.connect.mutationOptions({
      onSuccess: () => {
        toast.success(t('pendingHeading'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.listParticipants.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getStatus.queryKey(),
        });
        onReset();
        onOpenChange(false);
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || tErrors('Generic'));
      },
    }),
  );

  const connect = (scheme: string, value: string, apiKey: string) => {
    (
      connectMutation.mutate as (input: {
        trn: string;
        aspProvider: string;
        environment: string;
        apiKey: string;
      }) => void
    )({
      trn: `${scheme}:${value}`,
      aspProvider: ASP_PROVIDER_DEFAULT,
      environment: ENVIRONMENT_DEFAULT,
      apiKey: apiKey || 'pending-sandbox-key',
    });
  };

  return {
    t,
    connect,
    isPending: connectMutation.isPending,
  } as const;
}
