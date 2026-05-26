import { useTranslations } from '../../i18n/useTranslations.js';

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
  const t = useTranslations('Peppol.qrDisplay');

  if (!qrCodeBase64) return null;

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-lg bg-muted/30 p-4">
      <img
        src={qrCodeBase64}
        alt={t('altText', { invoiceNumber })}
        width={200}
        height={200}
        className="rounded"
      />
      <p className="text-xs text-muted-foreground">{t('caption')}</p>
    </div>
  );
}
