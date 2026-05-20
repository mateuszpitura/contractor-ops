'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProrationPreviewProps {
  newPriceId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProrationPreview({
  newPriceId,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ProrationPreviewProps) {
  const t = useTranslations('Billing.proration');
  const { data, isLoading, isError } = useQuery(
    trpc.billing.getProrationPreview.queryOptions({ newPriceId }),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">{t('errorLoad')}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPLN = data.totalMinor / 100;
  const isCredit = totalPLN < 0;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <h3 className="text-sm font-semibold">{t('title')}</h3>

        {/* Line items */}
        <ul className="space-y-2">
          {data.lines.map((line: { description: string; amountMinor: number }) => (
            <li key={line.description} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{line.description}</span>
              <span className="tabular-nums font-medium">
                {(line.amountMinor / 100).toFixed(2)} PLN
              </span>
            </li>
          ))}
        </ul>

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{t('totalLabel')}</span>
          <span className="tabular-nums">{Math.abs(totalPLN).toFixed(2)} PLN</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {isCredit
            ? t('creditNote', { amount: Math.abs(totalPLN).toFixed(2) })
            : t('chargeNote', { amount: totalPLN.toFixed(2) })}
        </p>

        <div className="flex gap-2">
          <Button size="sm" disabled={isConfirming} onClick={onConfirm}>
            {t('confirm')}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
