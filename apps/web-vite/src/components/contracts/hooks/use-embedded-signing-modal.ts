import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const TRUSTED_DOCUSIGN_ORIGINS = [
  'https://app.docusign.com',
  'https://apps-d.docusign.com',
  'https://demo.docusign.net',
  'https://app-d.docusign.com',
];

type SigningEvent = 'signing_complete' | 'decline' | 'exception' | null;

function parseSigningEvent(data: unknown): SigningEvent {
  if (typeof data === 'string') {
    if (data === 'signing_complete' || data.includes('signing_complete')) return 'signing_complete';
    if (data === 'decline' || data.includes('decline')) return 'decline';
    if (data === 'exception' || data.includes('exception')) return 'exception';
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as { type?: string; event?: string };
    if ((obj.type ?? obj.event) === 'signing_complete') return 'signing_complete';
  }
  return null;
}

const SIGNING_EVENT_ACTIONS: Record<
  Exclude<SigningEvent, null>,
  { toastKey: string; toastFn: 'success' | 'error'; triggerComplete: boolean }
> = {
  signing_complete: { toastKey: 'signedSuccess', toastFn: 'success', triggerComplete: true },
  decline: { toastKey: 'signingDeclined', toastFn: 'error', triggerComplete: false },
  exception: { toastKey: 'signingFailed', toastFn: 'error', triggerComplete: false },
};

export function useEmbeddedSigningModal(
  envelopeId: string,
  recipientEmail: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onComplete: () => void,
  usePortalAuth?: boolean,
) {
  const tToast = useTranslations('ContractDetail.signing.toast');
  const trpc = useTRPC();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const returnUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/signing-complete`;

  const queryInput = { envelopeId, recipientEmail, returnUrl };
  const queryEnabled = { enabled: open && !!envelopeId && !!returnUrl };

  const signingUrlQuery = useQuery(
    usePortalAuth
      ? trpc.esign.getPortalSigningUrl.queryOptions(queryInput, queryEnabled)
      : trpc.esign.getSigningUrl.queryOptions(queryInput, queryEnabled),
  );

  const signingData = signingUrlQuery.data as
    | { embedded: boolean; url?: string; expiresAt?: string }
    | undefined;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!TRUSTED_DOCUSIGN_ORIGINS.some(o => event.origin.startsWith(o))) return;

      const signingEvent = parseSigningEvent(event.data);
      if (!signingEvent) return;

      const action = SIGNING_EVENT_ACTIONS[signingEvent];
      toast[action.toastFn](tKey(tToast, action.toastKey));
      if (action.triggerComplete) onComplete();
      onOpenChange(false);
    },
    [onComplete, onOpenChange, tToast],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, handleMessage]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return useMemo(
    () => ({
      iframeRef,
      isPending: signingUrlQuery.isPending,
      signingData,
    }),
    [signingData, signingUrlQuery.isPending],
  );
}
