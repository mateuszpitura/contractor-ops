import { useDownloadZugferdPdf } from '../hooks/use-download-zugferd-pdf.js';
import { DownloadZugferdPdfButton } from './download-zugferd-pdf-button.js';

interface DownloadZugferdPdfButtonContainerProps {
  invoiceId: string;
  className?: string;
}

// Thin button-level boundary: hook supplies the download mutation and its
// pending flag, which the button renders as a different label inline. No
// isLoading/isEmpty/isError variant to lift — kept to scope the tRPC
// boundary to the invoices folder.
export function DownloadZugferdPdfButtonContainer({
  invoiceId,
  className,
}: DownloadZugferdPdfButtonContainerProps) {
  const { onDownload, isPending } = useDownloadZugferdPdf(invoiceId);
  return (
    <DownloadZugferdPdfButton className={className} onDownload={onDownload} isPending={isPending} />
  );
}
