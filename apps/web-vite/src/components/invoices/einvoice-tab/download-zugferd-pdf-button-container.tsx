import { useDownloadZugferdPdf } from '../hooks/use-download-zugferd-pdf.js';
import { DownloadZugferdPdfButton } from './download-zugferd-pdf-button.js';

interface DownloadZugferdPdfButtonContainerProps {
  invoiceId: string;
  className?: string;
}

// Decision: button-level mutation host — the parent invoice detail screen
// already owns its own loading/empty/error gating, so this container exists
// only to scope the `einvoice.generateZugferdPdf` mutation (and its `isPending`
// label flip) inside the invoices folder. No variant pick to lift; the single
// button is the entire surface.
export function DownloadZugferdPdfButtonContainer({
  invoiceId,
  className,
}: DownloadZugferdPdfButtonContainerProps) {
  const { onDownload, isPending } = useDownloadZugferdPdf(invoiceId);
  return (
    <DownloadZugferdPdfButton className={className} onDownload={onDownload} isPending={isPending} />
  );
}
