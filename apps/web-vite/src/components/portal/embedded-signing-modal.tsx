import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink, Loader2, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

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

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">{documentTitle}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenChange(false)}
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
              <Button onClick={() => window.open(signingUrl, '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="me-1.5 size-4" />
                {t('continueToProvider', { provider: providerLabel })}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  return (
    <ModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t('loadError')}</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('returnToContract')}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
