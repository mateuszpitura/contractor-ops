import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export interface UsePdfPreviewResult {
  pdfUrl: string | null;
  loading: boolean;
}

/**
 * Loads a presigned PDF URL when the preview dialog is `open`, clearing the
 * URL when the dialog closes. Backed by tRPC `document.getDownloadUrl` via
 * `queryClient.fetchQuery` so the lookup is deduped + cached without
 * mounting a child query subtree.
 */
export function usePdfPreview(documentId: string, open: boolean): UsePdfPreviewResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    queryClient
      .fetchQuery(trpc.document.getDownloadUrl.queryOptions({ documentId }))
      .then(data => {
        if (cancelled) return;
        const url = (data as { url?: string } | undefined)?.url ?? null;
        setPdfUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPdfUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId, queryClient, trpc.document.getDownloadUrl]);

  return { pdfUrl, loading };
}
