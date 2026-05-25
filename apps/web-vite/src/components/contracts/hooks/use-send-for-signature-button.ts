import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

type SendButtonOptions = {
  contractStatus: string;
  hasDocument: boolean;
  hasConnectedProvider: boolean;
};

const SIGNABLE_STATUSES = new Set(['DRAFT', 'ACTIVE']);

/**
 * Visibility + tooltip + dialog state for the "Send for signature" CTA.
 * Keeps the presentational button pure — pre-conditions and i18n labels
 * are derived once here.
 */
export function useSendForSignatureButton({
  contractStatus,
  hasDocument,
  hasConnectedProvider,
}: SendButtonOptions) {
  const t = useTranslations('ContractDetail.signing');
  const [dialogOpen, setDialogOpen] = useState(false);

  const isVisible = SIGNABLE_STATUSES.has(contractStatus);
  const isDisabled = !(hasDocument && hasConnectedProvider);

  const tooltipMessage = hasDocument
    ? hasConnectedProvider
      ? undefined
      : t('tooltipNoProvider')
    : t('tooltipNoDocument');

  const openDialog = useCallback(() => setDialogOpen(true), []);

  return {
    isVisible,
    isDisabled,
    tooltipMessage,
    dialogOpen,
    setDialogOpen,
    openDialog,
    label: t('sendButton'),
  } as const;
}
