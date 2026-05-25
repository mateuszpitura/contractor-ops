import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalLogin() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState<string>('');

  const requestMagicLink = useMutation(
    trpc.portal.requestMagicLink.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.magicLinkSent'));
        void queryClient.invalidateQueries(trpc.portal.pathFilter());
      },
    }),
  );

  const submitEmail = useCallback(
    async (email: string) => {
      try {
        await requestMagicLink.mutateAsync({ email });
        setSentEmail(email);
        setSent(true);
      } catch {
        // toast emitted by mutation onError
      }
    },
    [requestMagicLink],
  );

  const resetSent = useCallback(() => {
    setSent(false);
    setSentEmail('');
  }, []);

  return {
    isPending: requestMagicLink.isPending,
    sent,
    sentEmail,
    submitEmail,
    resetSent,
  } as const;
}
