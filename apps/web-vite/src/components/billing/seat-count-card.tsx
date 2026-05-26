import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@contractor-ops/ui/components/shadcn/progress';
import { Users } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeatCountCardProps {
  activeContractors: number;
  includedSeats: number;
  seatPriceMinor: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeatCountCard({
  activeContractors,
  includedSeats,
  seatPriceMinor,
}: SeatCountCardProps) {
  const t = useTranslations('Billing.usage');

  const overage = Math.max(0, activeContractors - includedSeats);
  const maxSeats = Math.max(includedSeats, activeContractors);
  const fillPercent = maxSeats > 0 ? (activeContractors / maxSeats) * 100 : 0;
  const pricePerSeat = seatPriceMinor / 100;
  const isOverLimit = overage > 0;
  const isNearLimit = !isOverLimit && includedSeats > 0 && activeContractors / includedSeats >= 0.8;

  return (
    <Card
      className={cn(
        'p-4',
        isOverLimit && 'ring-destructive/40 bg-destructive/3',
        isNearLimit && 'ring-warning/40 bg-warning/3',
      )}>
      <CardContent className="flex flex-1 flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">{t('activeSeats')}</span>
          <Users size={16} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="text-2xl font-semibold">{activeContractors}</div>

        <div className="mt-auto flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t('active', {
              active: String(activeContractors),
              included: String(includedSeats),
            })}
          </span>
          <Progress
            value={fillPercent}
            aria-valuenow={activeContractors}
            aria-valuemin={0}
            aria-valuemax={maxSeats}
            aria-label={t('active', {
              active: String(activeContractors),
              included: String(includedSeats),
            })}>
            <ProgressTrack>
              <ProgressIndicator
                style={{
                  backgroundColor: overage > 0 ? 'var(--warning)' : 'var(--primary)',
                }}
              />
            </ProgressTrack>
          </Progress>
          {overage > 0 && (
            <span className="text-xs text-warning mt-1">
              {t('overage', {
                overage: String(overage),
                price: String(pricePerSeat),
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
