import { useSendForSignatureDialog } from '../hooks/use-send-for-signature-dialog.js';
import { SendForSignatureDialog } from './send-for-signature-dialog.js';

type SendForSignatureDialogContainerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  documentId: string;
  contractParties: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
};

export function SendForSignatureDialogContainer(props: SendForSignatureDialogContainerProps) {
  const dialog = useSendForSignatureDialog(
    props.open,
    props.onOpenChange,
    props.contractId,
    props.documentId,
    props.contractParties,
  );

  return <SendForSignatureDialog {...props} dialog={dialog} />;
}
