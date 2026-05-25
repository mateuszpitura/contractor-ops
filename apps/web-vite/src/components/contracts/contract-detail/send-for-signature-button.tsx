import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { PenLine } from 'lucide-react';

import { useSendForSignatureButton } from '../hooks/use-send-for-signature-button.js';
import { SendForSignatureDialogContainer } from './send-for-signature-dialog-container.js';

type SendForSignatureButtonProps = {
  contractId: string;
  contractStatus: string;
  hasDocument: boolean;
  hasConnectedProvider: boolean;
  documentId?: string;
  contractParties?: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
};

/**
 * Primary CTA button for sending a contract document for e-signature.
 */
export function SendForSignatureButton({
  contractId,
  contractStatus,
  hasDocument,
  hasConnectedProvider,
  documentId,
  contractParties = [],
}: SendForSignatureButtonProps) {
  const { isVisible, isDisabled, tooltipMessage, dialogOpen, setDialogOpen, openDialog, label } =
    useSendForSignatureButton({ contractStatus, hasDocument, hasConnectedProvider });

  if (!isVisible) return null;

  if (isDisabled && tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="default" size="sm" disabled>
                <PenLine className="me-1.5 size-4" />
                {label}
              </Button>
            )}
          />
          <TooltipContent>{tooltipMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={openDialog}>
        <PenLine className="me-1.5 size-4" />
        {label}
      </Button>

      <SendForSignatureDialogContainer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractId={contractId}
        documentId={documentId ?? ''}
        contractParties={contractParties}
      />
    </>
  );
}
