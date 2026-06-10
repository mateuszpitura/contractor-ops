import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalLoginVerify() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();

  const verifyMagicLink = useResourceMutation(
    trpc.portal.verifyMagicLink.mutationOptions(),
    { successMessage: t('toast.verified') },
  );

  const selectOrg = useResourceMutation(
    trpc.portal.selectOrg.mutationOptions(),
    { successMessage: t('toast.verified') },
  );

  return { verifyMagicLink, selectOrg, t } as const;
}
