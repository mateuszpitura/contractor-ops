'use client';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolQRDisplayProps {
  qrCodeBase64: string;
  invoiceNumber: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays the UAE FTA QR code for a Peppol-AE invoice.
 * Rendered on the invoice detail view when QR data is present.
 */
export function PeppolQRDisplay({ qrCodeBase64, invoiceNumber }: PeppolQRDisplayProps) {
  if (!qrCodeBase64) return null;

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-lg bg-muted/30 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrCodeBase64}
        alt={`UAE FTA QR code for invoice ${invoiceNumber}`}
        width={200}
        height={200}
        className="rounded"
      />
      <p className="text-xs text-muted-foreground">UAE FTA QR Code — Scan to verify</p>
    </div>
  );
}
