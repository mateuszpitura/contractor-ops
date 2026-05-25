import { useJiraActivitySummary } from './hooks/use-jira-activity-summary.js';
import { JiraActivitySummarySkeleton, JiraActivitySummaryView } from './jira-activity-summary.js';

interface JiraActivitySummaryProps {
  contractorId: string;
}

export function JiraActivitySummary({ contractorId }: JiraActivitySummaryProps) {
  const { activityQuery, items, relativeTime, t } = useJiraActivitySummary(contractorId);
  if (activityQuery.isLoading) return <JiraActivitySummarySkeleton />;
  if (items.length === 0) return null;
  return <JiraActivitySummaryView items={items} relativeTime={relativeTime} t={t} />;
}
