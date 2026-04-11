"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { SendForSignatureDialog } from "./send-for-signature-dialog";

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
    role: "signer" | "countersigner";
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
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only show for DRAFT or ACTIVE contracts
  if (!["DRAFT", "ACTIVE"].includes(contractStatus)) {
    return null;
  }

  const isDisabled = !hasDocument || !hasConnectedProvider;
  const tooltipMessage = !hasDocument
    ? "Upload a document first"
    : !hasConnectedProvider
      ? "Connect a signing provider in Settings"
      : undefined;

  if (isDisabled && tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button {...props} variant="default" size="sm" disabled>
                <PenLine className="me-1.5 size-4" />
                Send for Signature
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
      <Button
        variant="default"
        size="sm"
        onClick={() => setDialogOpen(true)}
      >
        <PenLine className="me-1.5 size-4" />
        Send for Signature
      </Button>

      <SendForSignatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractId={contractId}
        documentId={documentId ?? ""}
        contractParties={contractParties}
      />
    </>
  );
}
