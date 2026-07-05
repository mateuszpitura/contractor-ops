import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Loader2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { BatchSummary } from './batch-summary.js';
import { useTax1099Batch } from './hooks/use-1099-batch.js';

export interface Tax1099BatchPanelProps {
  taxYear: number;
}

/**
 * Wired review-before-file 1099-NEC batch panel. Branches loading / error /
 * empty / loaded on the sole hook. "Generate" is a deliberate action; nothing is
 * filed here — staff review the generated recipients before filing on the
 * filing card. No `*-container.tsx`; the hook is the only tRPC boundary.
 */
export function Tax1099BatchPanel({ taxYear }: Tax1099BatchPanelProps) {
  const t = useTranslations('Tax1099Batch');
  const { isPending, error, isEmpty, forms, generate, isGenerating, generateError, refetch } =
    useTax1099Batch(taxYear);

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h3>
        <Button type="button" size="sm" onClick={() => void generate()} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
          {t('generate')}
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              {t('reload')}
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="space-y-2 py-12 text-center">
            <p className="font-display text-sm font-semibold">{t('empty.heading', { taxYear })}</p>
            <p className="text-sm text-muted-foreground">{t('empty.body', { taxYear })}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {generateError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('generateError')}
              </p>
            ) : null}
            <BatchSummary taxYear={taxYear} forms={forms} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
