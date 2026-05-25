import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink, Loader2, X } from 'lucide-react';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useEmbeddedSigningModal } from '../hooks/use-embedded-signing-modal.js';

type EmbeddedSigningModalProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean;
  modal: ReturnType<typeof useEmbeddedSigningModal>;
};

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
        // See portal/embedded-signing-modal.tsx for the rationale on each token.
        // Sandbox kept in sync between the portal + dashboard signing modals
        // so a hardening change applies uniformly to both DocuSign / Autenti
        // surfaces.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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
              <Button onClick={() => window.open(signingData.url, '_blank', 'noopener,noreferrer')}>
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

/**
 * Full-viewport overlay for embedded document signing.
 */
export function EmbeddedSigningModal({
  documentTitle,
  provider,
  open,
  onOpenChange,
  modal,
}: EmbeddedSigningModalProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('ContractDetail.signing.modal');

  const { iframeRef, isPending, signingData } = modal;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
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

      <div className="h-[calc(100dvh-56px)]">
        <SigningBody
          isPending={isPending}
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
