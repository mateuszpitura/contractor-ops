import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalPendingSignatures } from './use-portal-settings.js';

export type PendingSignatureItem = {
  envelopeId: string;
  contractId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientStatus: string;
  envelopeStatus: string;
  message: string | null;
  expiresAt: string | Date | null;
  sentAt: string | Date | null;
};

export type SigningTarget = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
};

export function usePortalPendingSignaturesView() {
  const pendingQuery = usePortalPendingSignatures();
  const [signingTarget, setSigningTarget] = useState<SigningTarget | null>(null);
  const t = useTranslations('Portal');

  const items = (pendingQuery.data ?? []) as PendingSignatureItem[];

  const handleSign = (item: PendingSignatureItem) => {
    setSigningTarget({
      envelopeId: item.envelopeId,
      recipientEmail: item.recipientEmail,
      documentTitle: `Contract #${item.contractId?.slice(-6) ?? t('pendingSignatures.na')}`,
    });
  };

  const clearSigningTarget = () => setSigningTarget(null);

  const handleSigningComplete = () => {
    setSigningTarget(null);
    void pendingQuery.refetch();
  };

  return {
    pendingQuery,
    items,
    signingTarget,
    handleSign,
    clearSigningTarget,
    handleSigningComplete,
  } as const;
}
