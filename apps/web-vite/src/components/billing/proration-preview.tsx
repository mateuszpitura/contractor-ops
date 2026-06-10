import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { TranslateFn } from '../../i18n/useTranslations.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useProrationPreview } from './hooks/use-billing.js';

export interface ProrationLine {
  description: string;
  amountMinor: number;
}

interface ProrationPreviewProps {
  t: TranslateFn;
  lines: ProrationLine[];
  totalMinor: number;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function ProrationPreviewView({
  t,
  lines,
  totalMinor,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ProrationPreviewProps) {
  const totalPLN = totalMinor / 100;
  const isCredit = totalPLN < 0;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <h3 className="text-sm font-semibold">{t('title')}</h3>

        <ul className="space-y-2">
          {lines.map(line => (
            <li key={line.description} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{line.description}</span>
              <span className="tabular-nums font-medium">
                {(line.amountMinor / 100).toFixed(2)} PLN
              </span>
            </li>
          ))}
        </ul>

        <Separator />

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

export function ProrationPreviewSkeleton() {
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

interface ProrationPreviewErrorProps {
  t: TranslateFn;
  onCancel: () => void;
}

export function ProrationPreviewError({ t, onCancel }: ProrationPreviewErrorProps) {
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

interface ProrationPreviewWiredProps {
  newPriceId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function ProrationPreview({
  newPriceId,
  onConfirm,
  onCancel,
  isConfirming,
}: ProrationPreviewWiredProps) {
  const t = useTranslations('Billing.proration');
  const { data, isLoading, isError } = useProrationPreview(newPriceId);

  if (isLoading) return <ProrationPreviewSkeleton />;
  if (isError || !data) return <ProrationPreviewError t={t} onCancel={onCancel} />;

  return (
    <ProrationPreviewView
      t={t}
      lines={data.lines}
      totalMinor={data.totalMinor}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isConfirming={isConfirming}
    />
  );
}
