'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { LooseTranslator } from '@/i18n/typed-keys';
import { tKey } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmbeddedSigningModalProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean;
};

// ---------------------------------------------------------------------------
// DocuSign event helpers
// ---------------------------------------------------------------------------

const TRUSTED_DOCUSIGN_ORIGINS = [
  'https://app.docusign.com',
  'https://apps-d.docusign.com',
  'https://demo.docusign.net',
  'https://app-d.docusign.com',
];

type SigningEvent = 'signing_complete' | 'decline' | 'exception' | null;

/** Extract a signing event name from a DocuSign postMessage payload. */
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

/** Map signing events to toast + callback actions. */
const SIGNING_EVENT_ACTIONS: Record<
  Exclude<SigningEvent, null>,
  { toastKey: string; toastFn: 'success' | 'error'; triggerComplete: boolean }
> = {
  signing_complete: { toastKey: 'signedSuccess', toastFn: 'success', triggerComplete: true },
  decline: { toastKey: 'signingDeclined', toastFn: 'error', triggerComplete: false },
  exception: { toastKey: 'signingFailed', toastFn: 'error', triggerComplete: false },
};

// ---------------------------------------------------------------------------
// Signing body content sub-component
// ---------------------------------------------------------------------------

function SigningBody({
  isPending,
  signingData,
  provider,
  documentTitle,
  iframeRef,
  onOpenChange,
  t,
}: {
  isPending: boolean;
  signingData: { embedded: boolean; url?: string } | undefined;
  provider: 'DOCUSIGN' | 'AUTENTI';
  documentTitle: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onOpenChange: (open: boolean) => void;
  t: LooseTranslator;
}) {
  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('preparing')}</p>
        </div>
      </div>
    );
  }

  if (signingData?.embedded && signingData.url) {
    return (
      <iframe
        ref={iframeRef}
        src={signingData.url}
        className="h-full w-full border-0"
        title={t('signTitle', { title: documentTitle })}
        allow="camera; microphone"
      />
    );
  }

  if (signingData?.url) {
    const providerLabel = provider === 'AUTENTI' ? 'Autenti' : provider;
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-[480px]">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-lg font-semibold">
              {provider === 'AUTENTI' ? 'Autenti' : t('completeSigning')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('redirectMessage', { provider: providerLabel })}
            </p>
            <div className="flex gap-3">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button onClick={() => window.open(signingData.url, '_blank')}>
                <ExternalLink className="me-1.5 size-4" />
                {t('continueToProvider', { provider: providerLabel })}
              </Button>
              {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('returnToContract')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{t('loadError')}</p>
        {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('returnToContract')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-viewport overlay for embedded document signing.
 * Per UI-SPEC D-05: iframe for DocuSign, redirect fallback for Autenti.
 */
export function EmbeddedSigningModal({
  envelopeId,
  recipientEmail,
  documentTitle,
  provider,
  open,
  onOpenChange,
  onComplete,
  usePortalAuth,
}: EmbeddedSigningModalProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('ContractDetail.signing.modal');
  const tToast = useTranslations('ContractDetail.signing.toast');
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

  // Listen for postMessage from DocuSign iframe
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

  // Prevent body scroll when modal is open
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">{documentTitle}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
          onClick={() => onOpenChange(false)}
          aria-label={tAria('closeSigningModal')}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="h-[calc(100dvh-56px)]">
        <SigningBody
          isPending={signingUrlQuery.isPending}
          signingData={signingData}
          provider={provider}
          documentTitle={documentTitle}
          iframeRef={iframeRef}
          onOpenChange={onOpenChange}
          t={t}
        />
      </div>
    </div>
  );
}
