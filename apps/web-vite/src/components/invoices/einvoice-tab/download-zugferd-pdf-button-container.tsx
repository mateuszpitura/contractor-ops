import { useDownloadZugferdPdf } from '../hooks/use-download-zugferd-pdf.js';
import { DownloadZugferdPdfButton } from './download-zugferd-pdf-button.js';

interface DownloadZugferdPdfButtonContainerProps {
  invoiceId: string;
  className?: string;
}

// Decision: mutation host — useDownloadZugferdPdf exposes onDownload + isPending
// consumed inline by the button view. Parent invoice detail owns the loading gate.
export function DownloadZugferdPdfButtonContainer({
  invoiceId,
  className,
}: DownloadZugferdPdfButtonContainerProps) {
  const { onDownload, isPending } = useDownloadZugferdPdf(invoiceId);
  return (
    <DownloadZugferdPdfButton className={className} onDownload={onDownload} isPending={isPending} />
  );
}
