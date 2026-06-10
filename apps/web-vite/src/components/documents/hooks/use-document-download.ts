import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

/**
 * Imperative document download trigger.
 *
 * Fetches a short-lived presigned URL via the tRPC `document.getDownloadUrl`
 * query (cached + deduped by React Query) and opens it in a new tab. Used by
 * document cards, version history rows, and any other consumer that needs an
 * on-demand download without rendering an extra query subtree.
 */
export function useDocumentDownload() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Documents');

  return useCallback(
    async (documentId: string): Promise<void> => {
      try {
        const data = await queryClient.fetchQuery(
          trpc.document.getDownloadUrl.queryOptions({ documentId }),
        );
        const url = data?.url;
        if (!url) {
          toast.error(t('pdfLoadError'));
          return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('pdfLoadError'));
      }
    },
    [queryClient, trpc.document.getDownloadUrl, t],
  );
}
