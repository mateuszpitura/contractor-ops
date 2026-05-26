import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalLoginVerify() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();

  const verifyMagicLink = useMutation(
    trpc.portal.verifyMagicLink.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.verified'));
      },
    }),
  );

  const selectOrg = useMutation(
    trpc.portal.selectOrg.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.verified'));
      },
    }),
  );

  return { verifyMagicLink, selectOrg, t } as const;
}
