'use client';

import { Globe } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolInboundBannerProps {
  senderParticipantId: string;
  senderName: string;
  documentType?: string;
  receivedAt: Date;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Info banner displayed on invoice detail when the invoice was received
 * via the Peppol network (source === "PEPPOL").
 */
export function PeppolInboundBanner({
  senderParticipantId,
  senderName,
  documentType,
  receivedAt,
}: PeppolInboundBannerProps) {
  return (
    <Alert className="border-info/20 bg-info/5">
      <Globe className="h-4 w-4 text-info" />
      <AlertTitle>Received via Peppol Network</AlertTitle>
      <AlertDescription className="space-y-1">
        <p className="font-mono text-sm">
          From: {senderParticipantId}
          {senderName ? ` (${senderName})` : ''}
        </p>
        {documentType && (
          <p className="text-sm text-muted-foreground">Document type: {documentType}</p>
        )}
        <p className="text-sm text-muted-foreground">Received: {receivedAt.toLocaleString()}</p>
      </AlertDescription>
    </Alert>
  );
}
