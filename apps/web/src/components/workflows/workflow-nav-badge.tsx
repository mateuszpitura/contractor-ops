'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { trpc } from '@/trpc/init';

/**
 * Overdue count badge for the sidebar Workflows nav item.
 * Polls every 60 seconds. Shows red circle with count (max "9+").
 * Renders nothing if count is 0.
 */
export function WorkflowNavBadge() {
  const tAria = useTranslations('Common.aria');
  const overdueQuery = useQuery({
    ...trpc.workflow.overdueCount.queryOptions(),
    refetchInterval: 60_000,
  });

  const count = (overdueQuery.data as { count: number } | undefined)?.count ?? 0;

  if (count === 0) return null;

  return (
    <span
      className="absolute -end-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-medium leading-none text-destructive-foreground"
      role="status"
      aria-label={tAria('overdueTasks', { count })}>
      {/* biome-ignore lint/nursery/noLeakedRender: count is intentionally rendered as text, and 0 is handled by early return */}
      {count > 9 ? '9+' : count}
    </span>
  );
}
