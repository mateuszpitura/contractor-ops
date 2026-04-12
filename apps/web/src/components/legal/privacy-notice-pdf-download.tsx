'use client';

import { useMutation } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
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
export function PrivacyNoticePdfDownload({ jurisdiction: _jurisdiction }: PrivacyNoticePdfDownloadProps) {
  const mutation = useMutation(
    trpc.legal.generatePrivacyNoticePdf.mutationOptions({
      onSuccess: (result) => {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Unable to generate PDF';
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
      onClick={() => mutation.mutate(undefined)}
      disabled={mutation.isPending}
      aria-label="Download privacy notice as PDF">
      {mutation.isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      Download as PDF
    </Button>
  );
}
