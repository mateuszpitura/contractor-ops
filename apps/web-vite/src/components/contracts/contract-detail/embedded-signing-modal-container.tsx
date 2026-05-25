import { useEmbeddedSigningModal } from '../hooks/use-embedded-signing-modal.js';
import { EmbeddedSigningModal } from './embedded-signing-modal.js';

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

export function EmbeddedSigningModalContainer(props: EmbeddedSigningModalContainerProps) {
  const modal = useEmbeddedSigningModal(
    props.envelopeId,
    props.recipientEmail,
    props.open,
    props.onOpenChange,
    props.onComplete,
    props.usePortalAuth,
  );

  return <EmbeddedSigningModal {...props} modal={modal} />;
}
