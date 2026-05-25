import { useLegalPrivacyPdfDownload } from './hooks/use-legal-privacy-pdf.js';
import { PrivacyNoticePdfDownload } from './privacy-notice-pdf-download.js';

export interface PrivacyNoticePdfDownloadContainerProps {
  jurisdiction: 'GB' | 'DE' | 'EU';
}

/**
 * Decision rule (apps/web-vite/ARCHITECTURE.md): thin mutation host. The
 * hook owns the `legal.generatePrivacyNoticePdf` mutation lifecycle plus
 * its success/error toasts and cache invalidation. The view is a single
 * button whose pending vs idle visual (Loader2 swap + `disabled`) is per-
 * attribute presentational state of the same render path — there is no
 * loading/error/empty variant to pick, no permission gate, no redirect,
 * and no composition. Kept as annotation-only per the audit's mutation-
 * host criterion.
 */
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
