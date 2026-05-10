'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bdi } from '@/components/ui/bdi';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  actorName: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  createdAt: Date | string;
}

interface GroupedActivities {
  label: string;
  items: ActivityItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Audit-log actions are stored as compound `resource.verb` strings
 * (e.g. `'invoice.approve'`, `'contractor.create'`). The i18n `actions`
 * map is keyed by the verb alone, so the resource prefix has to be
 * stripped before resolving the translation; otherwise next-intl
 * interprets the dot as a nested-path separator and throws
 * MISSING_MESSAGE.
 */
function actionVerb(action: string): string {
  const lastDot = action.lastIndexOf('.');
  return lastDot >= 0 ? action.slice(lastDot + 1) : action;
}

function getEntityHref(resourceType: string, resourceId: string): string {
  switch (resourceType) {
    case 'CONTRACTOR':
      return `/contractors/${resourceId}`;
    case 'CONTRACT':
      return `/contracts/${resourceId}`;
    case 'INVOICE':
      return `/invoices/${resourceId}`;
    case 'WORKFLOW_TEMPLATE':
    case 'WORKFLOW_RUN':
      return `/workflows`;
    case 'DOCUMENT':
      return `/documents`;
    case 'PAYMENT_RUN':
      return `/payments`;
    case 'APPROVAL_FLOW':
    case 'APPROVAL_STEP':
      return `/approvals`;
    default:
      return '#';
  }
}

/** Color-coded left border accent per resource type */
const RESOURCE_ACCENT: Record<string, string> = {
  CONTRACTOR: 'border-s-teal-400',
  CONTRACT: 'border-s-info',
  INVOICE: 'border-s-warning',
  WORKFLOW_TEMPLATE: 'border-s-accent-warm',
  WORKFLOW_RUN: 'border-s-accent-warm',
  DOCUMENT: 'border-s-muted-foreground/40',
  PAYMENT_RUN: 'border-s-success',
  APPROVAL_FLOW: 'border-s-primary',
  APPROVAL_STEP: 'border-s-primary',
};

function groupByDay(items: ActivityItem[]): GroupedActivities[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, ActivityItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const item of items) {
    const date = new Date(item.createdAt);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      groups.today.push(item);
    } else if (date.getTime() === yesterday.getTime()) {
      groups.yesterday.push(item);
    } else {
      groups.earlier.push(item);
    }
  }

  const result: GroupedActivities[] = [];
  if (groups.today.length > 0) result.push({ label: 'today', items: groups.today });
  if (groups.yesterday.length > 0) result.push({ label: 'yesterday', items: groups.yesterday });
  if (groups.earlier.length > 0) result.push({ label: 'earlier', items: groups.earlier });

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Activity feed showing last 20 audit log events grouped by today/yesterday/earlier.
 * Each event shows actor, action, resource type badge, and relative timestamp.
 * Color-coded left border per resource type.
 */
export function ActivityFeed() {
  const t = useTranslations('Dashboard');
  const { data, isLoading } = useQuery(trpc.dashboard.activity.queryOptions());

  const grouped = useMemo(() => groupByDay(data?.items ?? []), [data?.items]);

  return (
    <Card className="neon-card">
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">{t('activity.title')}</CardTitle>
        <CardAction>
          <Link href="/settings?tab=audit-log" className="text-sm text-primary hover:underline">
            {t('activity.seeAll')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`skel-${i}`} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('activity.empty')}</p>
        ) : (
          <ScrollArea className="scroll-fade-bottom max-h-[400px]">
            <div className="flex flex-col gap-4">
              {grouped.map(group => (
                <div key={group.label}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                    {t(`activity.${group.label}` as Parameters<typeof t>[0])}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map(item => {
                      const accent =
                        RESOURCE_ACCENT[item.resourceType] ?? 'border-s-muted-foreground/20';
                      return (
                        <div
                          key={item.id}
                          className={`rounded-lg border-s-2 ${accent} ps-3 pe-2.5 py-2 transition-all duration-200 hover:bg-surface-2 hover:ps-3.5`}>
                          <p className="text-sm">
                            <span className="text-foreground">
                              <Bdi>{item.actorName ?? t('activity.systemActor')}</Bdi>
                            </span>{' '}
                            <span className="font-semibold">
                              {t(
                                `activity.actions.${enumKey(actionVerb(item.action))}` as Parameters<
                                  typeof t
                                >[0],
                              )}
                            </span>
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {t(
                                `activity.resources.${enumKey(item.resourceType)}` as Parameters<
                                  typeof t
                                >[0],
                              )}
                            </Badge>
                            <Link
                              href={getEntityHref(item.resourceType, item.resourceId)}
                              className="min-w-0 truncate text-xs text-foreground hover:underline">
                              <Bdi>{item.resourceName ?? item.resourceId}</Bdi>
                            </Link>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                              {formatDistanceToNow(new Date(item.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
