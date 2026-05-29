/**
 * WHT certificate preview dialog — ported from
 * apps/web/src/components/payments/wht-certificate-preview-dialog.tsx.
 * Swaps:
 *   - next-intl → ../../i18n/useTranslations + ../../i18n/navigation (useLocale)
 *   - @/lib/format-currency → ../../lib/format-currency
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Download } from 'lucide-react';
import { useCallback } from 'react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/format-currency.js';
import { canViewSensitivePii, maskTaxId } from '../../lib/mask-pii.js';

interface WhtCertificatePreviewProps {
  open: boolean;
  onClose: () => void;
  certificate: {
    certificateNumber: string;
    orgName: string;
    contractorName: string;
    contractorTaxId?: string | null;
    contractorCountry: string;
    paymentDate: string;
    currency: string;
    grossAmountMinor: number;
    whtRate: number;
    whtAmountMinor: number;
    netAmountMinor: number;
    treatyApplied: boolean;
    treatyReference?: string | null;
  } | null;
  onDownload?: () => void;
}

export function WhtCertificatePreviewDialog({
  open,
  onClose,
  certificate,
  onDownload,
}: WhtCertificatePreviewProps) {
  const t = useTranslations('Payments.wht');
  const locale = useLocale();
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) onClose();
    },
    [onClose],
  );
  if (!certificate) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-card p-6">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              {t('certificateHeading')}
            </h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {t('certificateNo', { number: certificate.certificateNumber })}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">{t('organization')}</span>
              <span className="font-medium">{certificate.orgName}</span>
              <span className="text-muted-foreground">{t('contractor')}</span>
              <span className="font-medium">{certificate.contractorName}</span>
              {!!certificate.contractorTaxId && (
                <>
                  <span className="text-muted-foreground">{t('taxId')}</span>
                  <span className="font-medium">
                    {showPii ? certificate.contractorTaxId : maskTaxId(certificate.contractorTaxId)}
                  </span>
                </>
              )}
              <span className="text-muted-foreground">{t('paymentDate')}</span>
              <span className="font-medium">{certificate.paymentDate}</span>
            </div>

            <hr className="border-border" />

            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">{t('grossAmount')}</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.grossAmountMinor, certificate.currency, locale)}
              </span>
              <span className="text-muted-foreground">{t('rate')}</span>
              <span className="font-semibold">{certificate.whtRate}%</span>
              <span className="text-muted-foreground">{t('amount')}</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.whtAmountMinor, certificate.currency, locale)}
              </span>
              <span className="text-muted-foreground">{t('netPaid')}</span>
              <span className="font-mono font-semibold">
                {certificate.currency}{' '}
                {formatMinorUnits(certificate.netAmountMinor, certificate.currency, locale)}
              </span>
            </div>

            {!!certificate.treatyApplied && !!certificate.treatyReference && (
              <p className="text-xs italic text-muted-foreground">
                {t('treaty', { reference: certificate.treatyReference })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          <Button onClick={onDownload}>
            <Download className="me-2 h-4 w-4" />
            {t('downloadPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
