import { useCallback } from 'react';
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
  const handleDownload = useCallback(() => mutation.mutate(undefined), [mutation]);
  return (
    <PrivacyNoticePdfDownload
      jurisdiction={jurisdiction}
      isPending={mutation.isPending}
      onDownload={handleDownload}
    />
  );
}
