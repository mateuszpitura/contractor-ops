import { AtelierEmptyState } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { FileText } from 'lucide-react';
import { useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EwidencjaSnapshotTable } from './ewidencja-snapshot-table.js';
import type { EwidencjaPeriodRow } from './hooks/use-ewidencja.js';

interface EwidencjaReportViewProps {
  periods: EwidencjaPeriodRow[];
  workerName: string;
  onGenerate: (periodStart: string, periodEnd: string) => void;
  onRegenerate: (period: EwidencjaPeriodRow) => void;
  isGenerating: boolean;
  locale: string;
}

/**
 * KP §149 working-time register. The generate form freezes a period into a new
 * immutable snapshot; the table lists the current snapshot per period (with the
 * immutable badge) and expands into the superseded version chain.
 */
export function EwidencjaReportView({
  periods,
  workerName,
  onGenerate,
  onRegenerate,
  isGenerating,
  locale,
}: EwidencjaReportViewProps) {
  const t = useTranslations('Ewidencja');
  const id = useId();
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  const canGenerate = periodStart.length > 0 && periodEnd.length > 0 && periodStart <= periodEnd;
  const periodLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(periodStart),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-start`}>{t('columns.period')}</Label>
          <Input
            id={`${id}-start`}
            type="date"
            value={periodStart}
            onChange={event => setPeriodStart(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-end`} className="sr-only">
            {t('columns.period')}
          </Label>
          <Input
            id={`${id}-end`}
            type="date"
            value={periodEnd}
            onChange={event => setPeriodEnd(event.target.value)}
          />
        </div>
        <Button
          disabled={!canGenerate || isGenerating}
          onClick={() => onGenerate(periodStart, periodEnd)}>
          <FileText className="h-4 w-4" />
          {t('generate')}
        </Button>
      </div>

      {periods.length === 0 ? (
        <AtelierEmptyState
          variant="subview"
          icon={FileText}
          heading={t('empty.heading')}
          body={t('empty.body', { employee: workerName, period: periodLabel })}
          renderAction={() => null}
        />
      ) : (
        <EwidencjaSnapshotTable
          periods={periods}
          onRegenerate={onRegenerate}
          isGenerating={isGenerating}
          locale={locale}
        />
      )}
    </div>
  );
}
