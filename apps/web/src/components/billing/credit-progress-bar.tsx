'use client';

import { useTranslations } from 'next-intl';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditProgressBarProps {
  used: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Color logic per UI-SPEC thresholds
// ---------------------------------------------------------------------------

function getBarColor(used: number, total: number): string {
  if (total === 0) return 'var(--destructive)';
  const remaining = total - used;
  const pct = remaining / total;
  if (pct > 0.5) return 'var(--success)'; // >50% remaining: green
  if (pct >= 0.2) return 'var(--warning)'; // 20-50%: yellow
  return 'var(--destructive)'; // <20%: red
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditProgressBar({ used, total }: CreditProgressBarProps) {
  const t = useTranslations('Billing.credits');

  const remaining = Math.max(0, total - used);
  const percentUsed = total > 0 ? (used / total) * 100 : 100;
  const isExhausted = total > 0 && remaining <= 0;
  const barColor = getBarColor(used, total);

  return (
    <div className="space-y-2">
      <Progress
        value={percentUsed}
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('remaining', {
          remaining: String(remaining),
          total: String(total),
        })}>
        <ProgressTrack>
          <ProgressIndicator style={{ backgroundColor: barColor }} />
        </ProgressTrack>
      </Progress>

      <p
        className={`text-sm ${isExhausted ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
        {isExhausted
          ? t('exhausted')
          : t('remaining', {
              remaining: String(remaining),
              total: String(total),
            })}
      </p>
    </div>
  );
}
