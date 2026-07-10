import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
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

      <Table className="min-w-[28rem]">
        <TableHeader>
          <TableRow>
            <TableHead>{t('summary.recipient')}</TableHead>
            <TableHead className="text-end">{t('summary.box1')}</TableHead>
            <TableHead className="text-end">{t('summary.box4')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forms.map(form => (
            <TableRow key={form.id}>
              <TableCell>{form.recipient.legalName}</TableCell>
              <TableCell className="text-end font-mono">{usd(form.box1AmountMinor)}</TableCell>
              <TableCell className="text-end font-mono">
                {usd(form.box4BackupWithholdingMinor)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('summary.total')}</TableCell>
            <TableCell className="text-end font-mono">{usd(totalBox1)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('adviserNote')}</span>
      </p>
    </div>
  );
}
