import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface RecentActivityItem {
  id: string;
  externalId: string;
  externalUrl: string;
  metadataJson: {
    key: string;
    summary: string;
    status: string;
    statusCategory: 'new' | 'indeterminate' | 'done';
    url: string;
  };
  updatedAt: string;
}

export function useJiraActivitySummary(contractorId: string) {
  const trpc = useTRPC();
  const t = useTranslations('Integrations.jira.activitySummary');
  const activityQuery = useQuery(trpc.jira.recentActivity.queryOptions({ contractorId, limit: 5 }));

  const relativeTime = (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return t('relativeTime.justNow');
    if (minutes < 60) return t('relativeTime.minutesAgo', { n: minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('relativeTime.hoursAgo', { n: hours });

    const days = Math.floor(hours / 24);
    if (days < 30) return t('relativeTime.daysAgo', { n: days });

    const months = Math.floor(days / 30);
    return t('relativeTime.monthsAgo', { n: months });
  };

  const items = (activityQuery.data ?? []) as unknown as RecentActivityItem[];

  return {
    activityQuery,
    items,
    relativeTime,
    t,
  } as const;
}
