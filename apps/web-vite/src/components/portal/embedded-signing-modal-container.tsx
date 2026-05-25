import {
  EmbeddedSigningError,
  EmbeddedSigningIframe,
  EmbeddedSigningPreparing,
  EmbeddedSigningRedirect,
} from './embedded-signing-modal.js';
import { usePortalEmbeddedSigningModal } from './hooks/use-portal-embedded-signing-modal.js';

type EmbeddedSigningModalContainerProps = {
  envelopeId: string;
  recipientEmail: string;
  documentTitle: string;
  provider: 'DOCUSIGN' | 'AUTENTI';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  usePortalAuth?: boolean;
};

export function EmbeddedSigningModalContainer({
  envelopeId,
  recipientEmail,
  documentTitle,
  provider,
  open,
  onOpenChange,
  onComplete,
  usePortalAuth,
}: EmbeddedSigningModalContainerProps) {
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
