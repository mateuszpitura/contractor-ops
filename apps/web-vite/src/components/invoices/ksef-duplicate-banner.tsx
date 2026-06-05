/**
 * KSeF duplicate banner. Step 11 codemod port from
 * apps/web/src/components/invoices/ksef-duplicate-banner.tsx:
 *   - `next-intl`         → `../../i18n/useTranslations.js`
 *   - `@/i18n/navigation` → `../../i18n/navigation.js`
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

interface KsefDuplicateBannerProps {
  duplicateInvoiceId: string;
  invoiceNumber: string;
  sellerNip: string;
  onVoid?: () => void;
}

export function KsefDuplicateBanner({
  duplicateInvoiceId,
  invoiceNumber,
  sellerNip,
  onVoid,
}: KsefDuplicateBannerProps) {
  const t = useTranslations('ksef');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const handleOpenVoidDialog = useCallback(() => {
    setVoidDialogOpen(true);
  }, []);

  const handleConfirmVoid = useCallback(() => {
    onVoid?.();
    setVoidDialogOpen(false);
  }, [onVoid]);

  return (
    <>
      <div className="rounded-md border border-amber-500/30 border-s-4 border-s-amber-500 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t('duplicateHeading')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('duplicateBody', { invoiceNumber, sellerNip })}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/invoices/${duplicateInvoiceId}`}
                className="text-sm text-primary hover:underline">
                {t('duplicateViewKsef')}
              </Link>
              {!!onVoid && (
                <Button variant="destructive" size="sm" onClick={handleOpenVoidDialog}>
                  <Trash2 className="me-1.5 size-4" />
                  {t('duplicateVoid')}
                </Button>
              )}
              <Button variant="ghost" size="sm">
                {t('duplicateKeep')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('voidConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('voidConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('voidConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmVoid}>
              {t('voidConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
