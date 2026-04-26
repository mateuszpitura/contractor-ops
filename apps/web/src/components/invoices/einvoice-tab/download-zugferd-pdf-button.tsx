'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

interface DownloadZugferdPdfButtonProps {
  invoiceId: string;
  className?: string;
}

/**
 * Outbound "Download ZUGFeRD PDF" button. Calls the content-addressed
 * idempotent `einvoice.generateZugferdPdf` mutation — subsequent clicks
 * for the same invoice bytes return the existing R2 key without emitting
 * a second ZUGFERD_GENERATED event (see Plan 62-05 Summary §Decisions).
 *
 * On success: creates a transient `<a download>` anchor and clicks it —
 * the browser initiates the file download without opening a new tab.
 * Revokes the object URL immediately so memory leaks are impossible.
 * (The signed URL itself is the direct R2 download; no blob conversion.)
 */
export function DownloadZugferdPdfButton({ invoiceId, className }: DownloadZugferdPdfButtonProps) {
  const t = useTranslations('EInvoice.intake');
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    trpc.einvoice.generateZugferdPdf.mutationOptions({
      onSuccess: result => {
        const signedUrl = (result as { signedUrl?: string } | undefined)?.signedUrl;
        if (!signedUrl) {
          toast.error(t('genFailureToast'));
          return;
        }
        // Trigger browser download via a transient <a download> anchor —
        // works across browsers without opening an extra tab. We stay on
        // the current tab so the invoice-detail state is preserved.
        const anchor = document.createElement('a');
        anchor.href = signedUrl;
        anchor.download = `invoice-${invoiceId}-zugferd.pdf`;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success(t('genSuccessToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
        });
      },
      onError: () => {
        toast.error(t('genFailureToast'));
      },
    }),
  );

  const handleClick = useCallback(() => {
    generateMutation.mutate({ invoiceId });
  }, [generateMutation, invoiceId]);

  const isPending = generateMutation.isPending;

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={className}
      data-testid="download-zugferd-pdf-button">
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{t('generatingLabel')}</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{t('ctaDownloadZugferd')}</span>
        </>
      )}
    </Button>
  );
}
