// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — DownloadCsvButton
// ---------------------------------------------------------------------------
//
// Triggers the per-market `exportMarketCsv` mutation, receives a 300s signed
// R2 URL, and initiates a browser download. Shows a spinner + disabled state
// during the round-trip; announces the outcome via toast for screen readers.

'use client';

import { useMutation } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

export interface DownloadCsvButtonProps {
  market: 'GB' | 'DE';
}

export function DownloadCsvButton({ market }: DownloadCsvButtonProps) {
  const t = useTranslations('Classification.polish.dashboard');

  const mutation = useMutation(
    trpc.classificationDashboard.exportMarketCsv.mutationOptions({
      onSuccess: (result: { url: string }) => {
        // Trigger a browser download via a temporary anchor. R2 signed URLs are
        // cross-origin so `download` and `target` have no effect; the browser
        // relies on the Content-Disposition: attachment header set by R2.
        if (typeof window !== 'undefined') {
          const anchor = document.createElement('a');
          anchor.href = result.url;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }
      },
      onError: () => {
        toast.error(t('downloadCsv'));
      },
    }),
  );

  const isPending = mutation.status === 'pending';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => mutation.mutate({ market })}
      aria-label={t('downloadCsv')}
      data-market={market}
      data-testid={`download-csv-${market.toLowerCase()}`}>
      {isPending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      <span>{isPending ? t('downloadingLabel') : t('downloadCsv')}</span>
    </Button>
  );
}
