/**
 * Staff 1042-S batch review surface (US-source foreign-recipient withholding).
 *
 * Review-before-file: "Generate 1042-S batch" produces a reviewable summary of
 * per-recipient withholding; filing is a separate, deliberate action elsewhere.
 * A recipient without a complete W-8 chain is reported at the 30% statutory rate
 * with an amber advisory caption — never blocked from filing. FTIN is last-4 only
 * via the gated SsnMaskedReveal; the full foreign TIN never reaches the DOM.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Info } from 'lucide-react';
import { usePermissions } from '../../../hooks/use-permissions.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { SsnMaskedReveal } from '../compliance/ssn-masked-reveal.js';
import type { Form1042SBatchSummary, Form1042SRecipientRow } from './hooks/use-1042s-batch.js';
import { useForm1042sBatch } from './hooks/use-1042s-batch.js';
import { Tax1042SBatchSummary } from './tax-1042s-batch-summary.js';
import { TreatyRateCaption } from './treaty-rate-caption.js';

export interface Tax1042SBatchPanelViewProps {
  taxYear: number;
  isPending: boolean;
  error: unknown;
  isEmpty: boolean;
  rows: Form1042SRecipientRow[];
  summary: Form1042SBatchSummary;
  canRevealPii: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onReload: () => void;
}

function RecipientRow({
  row,
  canRevealPii,
}: {
  row: Form1042SRecipientRow;
  canRevealPii: boolean;
}) {
  const t = useTranslations('Tax1042SBatch');
  const format = useFormatter();

  const money = (minor: number) =>
    format.number(minor / 100, { style: 'currency', currency: row.currency });

  return (
    <li className="space-y-card-gap rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">
            <Bdi>{row.recipientName}</Bdi>
          </p>
          {row.corrected ? (
            <Badge variant="secondary" className="w-fit">
              {t('correctedBadge')}
            </Badge>
          ) : null}
        </div>
        {row.ftinLast4 ? (
          <SsnMaskedReveal
            contractorId={row.recipientId}
            last4={row.ftinLast4}
            canReveal={canRevealPii}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t('noFtin')}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">{t('columns.income')}</dt>
          <dd className="font-mono">{money(row.grossIncomeMinor)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">{t('columns.rate')}</dt>
          <dd className="font-mono">
            {row.ratePercent === null ? t('rateUnknown') : `${row.ratePercent}%`}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">{t('columns.withheld')}</dt>
          <dd className="font-mono">{money(row.withheldMinor)}</dd>
        </div>
      </dl>

      <TreatyRateCaption
        treatyArticle={row.treatyArticle}
        ratePercent={row.ratePercent}
        isStatutory={row.isStatutory}
      />
    </li>
  );
}

export function Tax1042SBatchPanelView({
  taxYear,
  isPending,
  error,
  isEmpty,
  rows,
  summary,
  canRevealPii,
  isGenerating,
  onGenerate,
  onReload,
}: Tax1042SBatchPanelViewProps) {
  const t = useTranslations('Tax1042SBatch');

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h3>
        {isPending || error || isEmpty ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
            aria-busy={isGenerating}>
            {t('regenerateCta')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-card-gap">
        {isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onReload}>
              {t('reload')}
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="space-y-3 py-6 text-center">
            <p className="font-display text-sm font-semibold">{t('empty.heading', { taxYear })}</p>
            <p className="mx-auto max-w-prose text-sm text-muted-foreground">{t('empty.body')}</p>
            <Button
              type="button"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
              aria-busy={isGenerating}>
              {t('generateCta')}
            </Button>
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {t('generatedAnnounce', { taxYear, count: summary.recipientCount })}
            </p>
            <Tax1042SBatchSummary summary={summary} />
            <ul className="space-y-card-gap">
              {rows.map(row => (
                <RecipientRow key={row.id} row={row} canRevealPii={canRevealPii} />
              ))}
            </ul>
          </>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t('adviserNote')}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export interface Tax1042SBatchPanelProps {
  taxYear?: number;
}

export function Tax1042SBatchPanel({ taxYear }: Tax1042SBatchPanelProps) {
  const batch = useForm1042sBatch(taxYear);
  const { can } = usePermissions();

  return (
    <Tax1042SBatchPanelView
      taxYear={batch.taxYear}
      isPending={batch.isPending}
      error={batch.error}
      isEmpty={batch.isEmpty}
      rows={batch.rows}
      summary={batch.summary}
      canRevealPii={can('contractorPii', ['read'])}
      isGenerating={batch.isGenerating}
      onGenerate={batch.generate}
      onReload={batch.refetch}
    />
  );
}
