'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

export interface PrivacyNoticePdfDownloadProps {
  /** Jurisdiction is only used to localise the accessible label. The actual
   *  PDF jurisdiction is always derived server-side from the authenticated
   *  session (`ctx.session.user.organization.countryCode`) to prevent IDOR
   *  per ASVS V4 — see `packages/api/src/routers/legal.ts`. */
  jurisdiction: 'GB' | 'DE' | 'EU';
}

/**
 * Phase 56 · Plan 07 — Download-as-PDF CTA for privacy notices.
 *
 * Calls the IDOR-safe `legal.generatePrivacyNoticePdf` tRPC mutation (input
 * `z.object({}).optional()` — no user-supplied jurisdiction accepted) and
 * opens the short-TTL signed R2 URL in a new tab.
 *
 * Unauthenticated visitors see the button but the mutation returns
 * UNAUTHORIZED; the toast surfaces a friendly fallback message.
 */
export function PrivacyNoticePdfDownload({
  jurisdiction: _jurisdiction,
}: PrivacyNoticePdfDownloadProps) {
  const t = useTranslations('Legal.privacy');
  const queryClient = useQueryClient();
  const mutation = useMutation(
    trpc.legal.generatePrivacyNoticePdf.mutationOptions({
      // P2-F · F-SCALE-02 — privacy notice PDF render now runs async via
      // QStash. The download link arrives by email and via the in-app
      // exports panel; surface a queued toast immediately.
      onSuccess: () => {
        toast.success(t('exportQueued'));
        queryClient.invalidateQueries(trpc.legal.pathFilter());
      },
      onError: error => {
        const message = error instanceof Error ? error.message : t('pdfError');
        toast.error(message);
      },
    }),
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-[44px] gap-2"
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onClick={() => mutation.mutate(undefined)}
      disabled={mutation.isPending}
      aria-label={t('downloadAsPdfAriaLabel')}>
      {mutation.isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {t('downloadAsPdf')}
    </Button>
  );
}
