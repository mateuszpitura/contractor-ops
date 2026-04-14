// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — DownloadCsvButton
// ---------------------------------------------------------------------------
//
// Triggers the per-market `exportMarketCsv` mutation, receives a 300s signed
// R2 URL, and initiates a browser download. Shows a spinner + disabled state
// during the round-trip; announces the outcome via toast for screen readers.

'use client';

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

  const mutation = trpc.classificationDashboard.exportMarketCsv.useMutation({
    onSuccess: result => {
      // Trigger a browser download via a temporary anchor. Using window.location
      // directly would navigate the tab; an anchor with `download` hints the
      // browser to save the signed URL to disk.
      if (typeof window !== 'undefined') {
        const anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.rel = 'noopener noreferrer';
        anchor.target = '_self';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    },
    onError: () => {
      toast.error(t('downloadCsv'));
    },
  });

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
