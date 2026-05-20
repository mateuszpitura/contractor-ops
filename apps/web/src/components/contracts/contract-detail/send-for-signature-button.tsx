'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SendForSignatureDialog } from './send-for-signature-dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SendForSignatureButtonProps = {
  contractId: string;
  contractStatus: string;
  hasDocument: boolean;
  hasConnectedProvider: boolean;
  /** Pre-selected document ID (when triggered from document row) */
  documentId?: string;
  /** Contract parties for signer auto-population */
  contractParties?: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Primary CTA button for sending a contract document for e-signature.
 * Visible when contract is DRAFT or ACTIVE. Disabled with tooltip when
 * no document is uploaded or no signing provider is connected.
 */
export function SendForSignatureButton({
  contractId,
  contractStatus,
  hasDocument,
  hasConnectedProvider,
  documentId,
  contractParties = [],
}: SendForSignatureButtonProps) {
  const t = useTranslations('ContractDetail.signing');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only show for DRAFT or ACTIVE contracts
  if (!['DRAFT', 'ACTIVE'].includes(contractStatus)) {
    return null;
  }

  const isDisabled = !(hasDocument && hasConnectedProvider);
  const tooltipMessage = hasDocument
    ? hasConnectedProvider
      ? undefined
      : t('tooltipNoProvider')
    : t('tooltipNoDocument');

  if (isDisabled && tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="default" size="sm" disabled>
                <PenLine className="me-1.5 size-4" />
                {t('sendButton')}
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
      {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
      <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
        <PenLine className="me-1.5 size-4" />
        {t('sendButton')}
      </Button>

      <SendForSignatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractId={contractId}
        documentId={documentId ?? ''}
        contractParties={contractParties}
      />
    </>
  );
}
