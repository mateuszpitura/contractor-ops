/**
 * Deadlines widget — contract expirations, overdue tasks, due invoices.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Link } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDeadlinesWidget } from './hooks/use-deadlines-widget.js';

type DeadlineType = 'CONTRACT_EXPIRING' | 'TASK_OVERDUE' | 'INVOICE_DUE';

function getEntityHref(type: DeadlineType, entityId: string): string {
  switch (type) {
    case 'CONTRACT_EXPIRING':
      return `/contracts/${entityId}`;
    case 'TASK_OVERDUE':
      return `/workflows?tab=tasks`;
    case 'INVOICE_DUE':
      return `/invoices/${entityId}`;
  }
}

const DEADLINE_BADGE_CONFIG: Record<
  DeadlineType,
  { variant: 'warning' | 'destructive' | 'info'; labelKey: string; accent: string }
> = {
  CONTRACT_EXPIRING: {
    variant: 'warning',
    labelKey: 'deadlines.badgeContract',
    accent: 'border-s-warning',
  },
  TASK_OVERDUE: {
    variant: 'destructive',
    labelKey: 'deadlines.badgeTask',
    accent: 'border-s-destructive',
  },
  INVOICE_DUE: {
    variant: 'info',
    labelKey: 'deadlines.badgeInvoice',
    accent: 'border-s-info',
  },
};

export function DeadlinesWidget() {
  const t = useTranslations('Dashboard');
  const { isLoading, items } = useDeadlinesWidget();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">{t('deadlines.title')}</CardTitle>
        <CardAction>
          <Link
            href="/reports?report=expiring-contracts"
            className="text-sm text-primary hover:underline">
            {t('deadlines.seeAll')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('deadlines.empty')}</p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="flex flex-col gap-2">
              {items.map(item => {
                const badge = DEADLINE_BADGE_CONFIG[item.type as DeadlineType];
                const isOverdue = 'daysOverdue' in item && item.daysOverdue != null;
                const days = (isOverdue ? item.daysOverdue : item.daysRemaining) ?? 0;

                return (
                  <div
                    key={`${item.type}-${item.entityId}`}
                    className={`flex items-center gap-3 rounded-lg border-s-2 ${badge.accent} ps-3 pe-2.5 py-2.5 transition-all duration-200 hover:bg-muted/40 hover:ps-3.5`}>
                    <Badge variant={badge.variant}>{tKey(t, badge.labelKey)}</Badge>
                    <Link
                      href={getEntityHref(item.type as DeadlineType, item.entityId)}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                      {item.entityName}
                    </Link>
                    <span
                      className={`shrink-0 text-xs font-mono tabular-nums ${
                        isOverdue ? 'font-bold text-destructive' : 'text-muted-foreground'
                      }`}>
                      {isOverdue
                        ? t('deadlines.overdue', { days })
                        : t('deadlines.upcoming', { days })}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
