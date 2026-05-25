import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink, Loader2, X } from 'lucide-react';

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

export function SigningBodyPending() {
  const t = useTranslations('ContractDetail.signing.modal');
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('preparing')}</p>
      </div>
    </div>
  );
}

export function SigningBodyEmbedded({
  url,
  documentTitle,
  iframeRef,
}: {
  url: string;
  documentTitle: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
  return (
    <iframe
      ref={iframeRef}
      src={url}
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

export function SigningBodyRedirect({
  url,
  provider,
  onOpenChange,
}: {
  url: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('ContractDetail.signing.modal');
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
            <Button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
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

export function SigningBodyError({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('ContractDetail.signing.modal');
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

export function EmbeddedSigningModalShell({
  documentTitle,
  onOpenChange,
  children,
}: {
  documentTitle: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
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
          // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
          onClick={() => onOpenChange(false)}
          aria-label={tAria('closeSigningModal')}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="h-[calc(100dvh-56px)]">{children}</div>
    </div>
  );
}

/**
 * Full-viewport overlay for embedded document signing.
 *
 * Kept as a single-render-path wrapper for back-compat with tests that target
 * variant branches via the `modal` prop. Containers should branch upstream
 * and render the body siblings directly.
 */
export function EmbeddedSigningModal({
  documentTitle,
  provider,
  open,
  onOpenChange,
  modal,
}: EmbeddedSigningModalProps) {
  const { iframeRef, isPending, signingData } = modal;

  if (!open) return null;

  let body: React.ReactNode;
  if (isPending) {
    body = <SigningBodyPending />;
  } else if (signingData?.embedded && signingData.url) {
    body = (
      <SigningBodyEmbedded
        url={signingData.url}
        documentTitle={documentTitle}
        iframeRef={iframeRef}
      />
    );
  } else if (signingData?.url) {
    body = (
      <SigningBodyRedirect url={signingData.url} provider={provider} onOpenChange={onOpenChange} />
    );
  } else {
    body = <SigningBodyError onOpenChange={onOpenChange} />;
  }

  return (
    <EmbeddedSigningModalShell documentTitle={documentTitle} onOpenChange={onOpenChange}>
      {body}
    </EmbeddedSigningModalShell>
  );
}
