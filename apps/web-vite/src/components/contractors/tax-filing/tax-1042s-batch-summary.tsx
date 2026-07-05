import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';

import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { Form1042SBatchSummary } from './hooks/use-1042s-batch.js';

export interface Tax1042SBatchSummaryProps {
  summary: Form1042SBatchSummary;
}

/**
 * Read-only totals for a generated 1042-S batch: recipient count, box-2 gross,
 * box-7 withheld, and the tax year. Amounts render in `font-mono` for scan
 * legibility. Presentational — the wired panel owns the data boundary.
 */
export function Tax1042SBatchSummary({ summary }: Tax1042SBatchSummaryProps) {
  const t = useTranslations('Tax1042SBatch.summary');
  const format = useFormatter();

  const money = (minor: number) =>
    format.number(minor / 100, {
      style: 'currency',
      currency: summary.currency,
    });

  return (
    <Card className="bg-muted/40">
      <CardHeader className="pb-0">
        <h4 className="font-display text-sm font-semibold leading-tight">{t('heading')}</h4>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('taxYear')}</dt>
            <dd className="font-mono">{summary.taxYear}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('recipients')}</dt>
            <dd className="font-mono">{summary.recipientCount}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('grossTotal')}</dt>
            <dd className="font-mono">{money(summary.totalGrossMinor)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{t('withheldTotal')}</dt>
            <dd className="font-mono">{money(summary.totalWithheldMinor)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
