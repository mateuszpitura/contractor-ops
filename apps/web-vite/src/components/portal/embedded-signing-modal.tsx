import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink, Loader2, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalEmbeddedSigningModal } from './hooks/use-portal-embedded-signing-modal.js';

function ModalShell({
  documentTitle,
  onOpenChange,
  children,
}: {
  documentTitle: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const tAria = useTranslations('Common.aria');
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">{documentTitle}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleClose}
          aria-label={tAria('closeSigningModal')}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="h-[calc(100dvh-56px)]">{children}</div>
    </div>
  );
}

export function EmbeddedSigningPreparing({
  documentTitle,
  onOpenChange,
}: {
  documentTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
  return (
    <ModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('preparing')}</p>
        </div>
      </div>
    </ModalShell>
  );
}

export function EmbeddedSigningIframe({
  documentTitle,
  signingUrl,
  iframeRef,
  onOpenChange,
}: {
  documentTitle: string;
  signingUrl: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
  return (
    <ModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
      <iframe
        ref={iframeRef}
        src={signingUrl}
        className="h-full w-full border-0"
        title={t('signTitle', { title: documentTitle })}
        allow="camera; microphone"
        // Narrow sandbox for the embedded DocuSign / Autenti signing widget:
        //   allow-scripts                       — their UI is a SPA.
        //   allow-same-origin                   — needed for their session storage.
        //   allow-forms                         — signing submits a form.
        //   allow-popups                        — provider may open a consent popup.
        //   allow-popups-to-escape-sandbox      — popups must run unsandboxed
        //                                          to function as expected.
        // `allow-top-navigation` is intentionally excluded so a compromised
        // provider cannot navigate the parent page.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </ModalShell>
  );
}

export function EmbeddedSigningRedirect({
  documentTitle,
  provider,
  signingUrl,
  onOpenChange,
}: {
  documentTitle: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  signingUrl: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
  const providerLabel = provider === 'AUTENTI' ? 'Autenti' : provider;
  const handleOpenProvider = useCallback(
    () => window.open(signingUrl, '_blank', 'noopener,noreferrer'),
    [signingUrl],
  );
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  return (
    <ModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
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
              <Button onClick={handleOpenProvider}>
                <ExternalLink className="me-1.5 size-4" />
                {t('continueToProvider', { provider: providerLabel })}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                {t('returnToContract')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModalShell>
  );
}

export function EmbeddedSigningError({
  documentTitle,
  onOpenChange,
}: {
  documentTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  return (
    <ModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t('loadError')}</p>
          <Button variant="outline" onClick={handleClose}>
            {t('returnToContract')}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

type EmbeddedSigningModalWiredProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean;
};

export function EmbeddedSigningModalWired({
  envelopeId,
  recipientEmail,
  documentTitle,
  provider,
  open,
  onOpenChange,
  onComplete,
  usePortalAuth,
}: EmbeddedSigningModalWiredProps) {
  const { iframeRef, isPending, signingData } = usePortalEmbeddedSigningModal(
    envelopeId,
    recipientEmail,
    open,
    onOpenChange,
    onComplete,
    usePortalAuth,
  );

  if (!open) return null;

  if (isPending) {
    return <EmbeddedSigningPreparing documentTitle={documentTitle} onOpenChange={onOpenChange} />;
  }

  if (signingData?.embedded && signingData.url) {
    return (
      <EmbeddedSigningIframe
        documentTitle={documentTitle}
        signingUrl={signingData.url}
        iframeRef={iframeRef}
        onOpenChange={onOpenChange}
      />
    );
  }

  if (signingData?.url) {
    return (
      <EmbeddedSigningRedirect
        documentTitle={documentTitle}
        provider={provider}
        signingUrl={signingData.url}
        onOpenChange={onOpenChange}
      />
    );
  }

  return <EmbeddedSigningError documentTitle={documentTitle} onOpenChange={onOpenChange} />;
}

/** @deprecated Use EmbeddedSigningModal */
export { EmbeddedSigningModalWired as EmbeddedSigningModal };
