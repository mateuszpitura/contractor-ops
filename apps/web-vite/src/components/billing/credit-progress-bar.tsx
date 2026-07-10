import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@contractor-ops/ui/components/shadcn/progress';
import { FileSearch } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditCardProps {
  used: number;
  total: number;
  remaining: number;
  isLowCredits: boolean;
  onBuyMore: () => void;
}

// ---------------------------------------------------------------------------
// Color logic per UI-SPEC thresholds
// ---------------------------------------------------------------------------

function getBarColor(used: number, total: number): string {
  if (total === 0) return 'var(--destructive)';
  const remaining = total - used;
  const pct = remaining / total;
  if (pct > 0.5) return 'var(--success)';
  if (pct >= 0.2) return 'var(--warning)';
  return 'var(--destructive)';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditCard({ used, total, remaining, isLowCredits, onBuyMore }: CreditCardProps) {
  const t = useTranslations('Billing.usage');
  const tCredits = useTranslations('Billing.credits');

  const displayRemaining = Math.max(0, remaining);
  const percentUsed = total > 0 ? (used / total) * 100 : 100;
  const isExhausted = total > 0 && displayRemaining <= 0;
  const isNearLimit = !isExhausted && total > 0 && displayRemaining / total < 0.2;
  const barColor = getBarColor(used, total);

  return (
    <Card
      className={cn(
        'p-4',
        isExhausted && 'ring-destructive/40 bg-destructive/3',
        isNearLimit && 'ring-warning/40 bg-warning/3',
      )}>
      <CardContent className="flex flex-1 flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">{t('ocrCredits')}</span>
          <div className="flex items-center gap-1.5">
            {!!isLowCredits && (
              <Button
                variant="outline"
                size="xs"
                className="h-5 text-[10px] font-medium"
                onClick={onBuyMore}>
                {tCredits('buyMore')}
              </Button>
            )}
            <FileSearch size={16} className="text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <div className="text-2xl font-semibold">{used}</div>

        <div className="mt-auto flex flex-col gap-1">
          <span
            className={`text-xs ${isExhausted ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {isExhausted
              ? tCredits('exhausted')
              : tCredits('usedOfTotal', {
                  used: String(used),
                  total: String(total),
                })}
          </span>
          <Progress
            value={percentUsed}
            aria-valuenow={displayRemaining}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={tCredits('remaining', {
              remaining: String(displayRemaining),
              total: String(total),
            })}>
            <ProgressTrack>
              <ProgressIndicator style={{ backgroundColor: barColor }} />
            </ProgressTrack>
          </Progress>
        </div>
      </CardContent>
    </Card>
  );
}
