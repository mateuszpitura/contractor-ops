import { useEmbeddedSigningModal } from '../hooks/use-embedded-signing-modal.js';
import {
  EmbeddedSigningModalShell,
  SigningBodyEmbedded,
  SigningBodyError,
  SigningBodyPending,
  SigningBodyRedirect,
} from './embedded-signing-modal.js';

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
  const { iframeRef, isPending, signingData } = useEmbeddedSigningModal(
    envelopeId,
    recipientEmail,
    open,
    onOpenChange,
    onComplete,
    usePortalAuth,
  );

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
