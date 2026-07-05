import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, Info } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTinMismatches } from './hooks/use-tin-mismatches.js';

export interface TinMismatchListProps {
  taxYear: number;
}

/**
 * Wired TIN-mismatch advisory list. The mismatch/backup-withholding surface is
 * amber `warning` — never red, and it offers NO control that blocks batch
 * generation (escalate / resolve are the only actions). Branches loading /
 * error / empty / loaded on the sole hook.
 */
export function TinMismatchList({ taxYear }: TinMismatchListProps) {
  const t = useTranslations('TinMismatch');
  const { isPending, error, isEmpty, mismatches, escalate, resolve, isMutating, refetch } =
    useTinMismatches(taxYear);

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <h3 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h3>
        {!(isPending || error) && mismatches.length > 0 ? (
          <Badge variant="warning">
            <AlertTriangle className="size-3" aria-hidden />
            <span>{t('advisoryBadge')}</span>
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-busy aria-live="polite">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          // This advisory surface never renders red — even a load error stays
          // amber so it can't be misread as a blocking failure.
          <div className="space-y-3">
            <p role="alert" className="text-sm text-warning">
              {t('loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              {t('reload')}
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="space-y-2 py-12 text-center">
            <p className="font-display text-sm font-semibold">{t('empty.heading')}</p>
            <p className="text-sm text-muted-foreground">{t('empty.body')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="flex items-start gap-1.5 text-sm text-warning">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t('advisory')}</span>
            </p>
            <ul className="divide-y">
              {mismatches.map(m => (
                <li
                  key={m.recipientId}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{m.recipientName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {t('tinMask', { last4: m.tinLast4 ?? '••••' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => void escalate(m.recipientId)}>
                      {t('escalate')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => void resolve(m.recipientId)}>
                      {t('resolve')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
