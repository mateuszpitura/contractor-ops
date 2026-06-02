/**
 * StepConfirmation — ported from
 * apps/web/src/components/payments/new-payment-run-dialog/step-confirmation.tsx.
 * Swaps:
 *   - next-intl → ../../../i18n/useTranslations
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { DialogBody, DialogFooter } from '@contractor-ops/ui/components/shadcn/dialog';
import { CheckCircle2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../../lib/format-currency.js';

interface StepConfirmationProps {
  runNumber: string;
  fileBase64: string;
  fileName: string;
  invoiceCount: number;
  totalMinor: number;
  currency: string;
  exportFormat: string;
  onViewRun: () => void;
  onClose: () => void;
}

export function StepConfirmation({
  runNumber,
  fileBase64,
  fileName,
  invoiceCount,
  totalMinor,
  currency,
  exportFormat,
  onViewRun,
  onClose,
}: StepConfirmationProps) {
  const t = useTranslations('Payments');

  const handleDownload = useCallback(() => {
    try {
      const byteCharacters = atob(fileBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      // safe-swallow: client-side blob download is best-effort; on failure the user can re-trigger the download button
    } catch {
      // Silent fail -- user can try again
    }
  }, [fileBase64, fileName]);

  const formatLabel =
    exportFormat === 'CSV' ? 'CSV' : exportFormat === 'BANK_FILE' ? 'Elixir' : 'SEPA XML';

  return (
    <>
      <DialogBody className="flex flex-col items-center gap-6 py-4">
        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />

        <h3 className="text-[20px] font-semibold text-center">
          {t('step3.successHeading', { runNumber })}
        </h3>

        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            {t('step3.invoices', { count: invoiceCount })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('step3.total')}: {formatMinorUnits(totalMinor, null, 'pl-PL')} {currency}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('step3.format')}: {formatLabel}
          </p>
        </div>

        <Button variant="outline" onClick={handleDownload}>
          {t('step3.downloadExport')}
        </Button>

        <button type="button" className="text-sm text-primary hover:underline" onClick={onViewRun}>
          {t('step3.viewPaymentRun')}
        </button>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('step3.close')}
        </Button>
      </DialogFooter>
    </>
  );
}
