import { useCallback, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalLogin() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState<string>('');

  const requestMagicLink = useResourceMutation(trpc.portal.requestMagicLink.mutationOptions(), {
    successMessage: t('toast.magicLinkSent'),
    invalidate: [trpc.portal.pathFilter()],
  });

  const submitEmail = useCallback(
    async (email: string) => {
      try {
        await requestMagicLink.mutateAsync({ email });
        setSentEmail(email);
        setSent(true);
        // safe-swallow: error already surfaced to the user via the mutation onError toast; only the sent-state flip is skipped
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
