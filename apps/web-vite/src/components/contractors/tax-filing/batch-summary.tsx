import { Info } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { Form1099Row } from './hooks/use-1099-batch.js';

/** USD minor units -> a fixed 2-decimal dollar string (display only). */
function usd(minor: number): string {
  return `$${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface BatchSummaryProps {
  taxYear: number;
  forms: Form1099Row[];
}

/**
 * Presentational batch summary — the recipients at or above the tax-year
 * threshold (only those persist) with box-1 / box-4 figures. Amounts are
 * `font-mono` for column alignment; the adviser-verify note is always shown.
 */
export function BatchSummary({ taxYear, forms }: BatchSummaryProps) {
  const t = useTranslations('Tax1099Batch');
  const totalBox1 = forms.reduce((sum, f) => sum + f.box1AmountMinor, 0);

  return (
    <div className="space-y-card-gap">
      <p className="text-sm text-muted-foreground">
        {t('summary.aboveThreshold', { count: forms.length, taxYear })}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b text-start text-xs text-muted-foreground">
              <th className="py-2 pe-3 text-start font-normal">{t('summary.recipient')}</th>
              <th className="py-2 pe-3 text-end font-normal">{t('summary.box1')}</th>
              <th className="py-2 text-end font-normal">{t('summary.box4')}</th>
            </tr>
          </thead>
          <tbody>
            {forms.map(form => (
              <tr key={form.id} className="border-b last:border-0">
                <td className="py-2 pe-3">{form.recipient.legalName}</td>
                <td className="py-2 pe-3 text-end font-mono">{usd(form.box1AmountMinor)}</td>
                <td className="py-2 text-end font-mono">{usd(form.box4BackupWithholdingMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td className="py-2 pe-3">{t('summary.total')}</td>
              <td className="py-2 pe-3 text-end font-mono">{usd(totalBox1)}</td>
              <td className="py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('adviserNote')}</span>
      </p>
    </div>
  );
}
