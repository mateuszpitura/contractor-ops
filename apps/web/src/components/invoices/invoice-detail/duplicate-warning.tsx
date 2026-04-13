'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DuplicateWarningProps = {
  invoiceId: string;
  duplicateInvoiceId: string | null;
  invoiceNumber: string;
  onDismiss?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Alert-style banner for duplicate invoice detection.
 * Displays when DUPLICATE_SUSPECTED flag is present in invoice.flagsJson.
 * Shows link to original invoice and dismiss action.
 */
export function DuplicateWarning({
  invoiceId,
  duplicateInvoiceId,
  invoiceNumber,
  onDismiss,
}: DuplicateWarningProps) {
  const t = useTranslations('Invoices');

  const dismissMutation = useMutation(
    trpc.invoice.dismissDuplicate.mutationOptions({
      onSuccess: () => {
        toast.success(t('duplicate.dismissedToast'));
        onDismiss?.();
      },
    }),
  );

  return (
    <Card className="border-s-[3px] border-s-destructive">
      <CardContent className="flex items-start gap-3 py-4 px-6">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-1">
          <h3 className="text-sm font-medium">{t('duplicate.heading')}</h3>
          <p className="text-sm text-muted-foreground">{t('duplicate.body', { invoiceNumber })}</p>
          <div className="flex items-center gap-2 pt-1">
            {!!duplicateInvoiceId && (
              <Link
                href={`/invoices/${duplicateInvoiceId}`}
                target="_blank"
                className="text-sm text-primary hover:underline">
                {t('duplicate.viewOriginal')}
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => dismissMutation.mutate({ id: invoiceId })}
              disabled={dismissMutation.isPending}>
              {!!dismissMutation.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('duplicate.notDuplicate')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
