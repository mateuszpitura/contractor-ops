import { useLegalPrivacyPdfDownload } from './hooks/use-legal-privacy-pdf.js';
import { PrivacyNoticePdfDownload } from './privacy-notice-pdf-download.js';

export interface PrivacyNoticePdfDownloadContainerProps {
  jurisdiction: 'GB' | 'DE' | 'EU';
}

// Decision: mutation host — useLegalPrivacyPdfDownload owns the
// generatePrivacyNoticePdf mutation; the view's button consumes isPending
// inline. Mounted by PrivacyNoticeLayout; no variant flag.
export function PrivacyNoticePdfDownloadContainer({
  jurisdiction,
}: PrivacyNoticePdfDownloadContainerProps) {
  const { mutation } = useLegalPrivacyPdfDownload();
  return (
    <PrivacyNoticePdfDownload
      jurisdiction={jurisdiction}
      isPending={mutation.isPending}
      // biome-ignore lint/nursery/noJsxPropsBind: trivial mutation trigger
      onDownload={() => mutation.mutate(undefined)}
    />
  );
}
