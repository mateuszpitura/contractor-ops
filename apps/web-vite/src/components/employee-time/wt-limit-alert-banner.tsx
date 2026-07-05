import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { TriangleAlert, X } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import type { WtFindingLevel } from './hooks/use-employee-time.js';

interface WtLimitAlertBannerProps {
  level: WtFindingLevel;
  title: string;
  message: string;
  onViewRecord?: () => void;
  onDismiss?: () => void;
}

/**
 * Shared working-time-limit banner (on-save sync check + daily scan). The
 * status-coloured headline is the single focal element; the warning-triangle
 * shape + text carry meaning independent of colour, and the region is announced
 * (assertive on breach, polite when approaching).
 */
export function WtLimitAlertBanner({
  level,
  title,
  message,
  onViewRecord,
  onDismiss,
}: WtLimitAlertBannerProps) {
  const t = useTranslations('EmployeeTime.wtLimit');
  const isBreach = level === 'breach';

  return (
    <div
      role="alert"
      aria-live={isBreach ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        isBreach
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-amber-500/30 bg-amber-500/10',
      )}>
      <TriangleAlert
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0',
          isBreach ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
        )}
        aria-hidden
      />
      <div className="flex-1 space-y-1">
        <p className="font-display text-[20px] font-semibold leading-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onViewRecord ? (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={onViewRecord}>
            {t('viewRecord')}
          </Button>
        ) : null}
      </div>
      {onDismiss ? (
        <Button variant="ghost" size="icon" aria-label={t('dismiss')} onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
