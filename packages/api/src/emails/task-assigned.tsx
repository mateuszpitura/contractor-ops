import { Text } from 'react-email';
import type { EmailBaseLabels } from './base-layout';
import { BaseLayout } from './base-layout';

interface TaskAssignedLabels {
  task?: string;
  workflow?: string;
  due?: string;
}

interface TaskAssignedEmailProps {
  title: string;
  body: string;
  taskName?: string;
  workflowName?: string;
  dueDate?: string;
  ctaUrl: string;
  preferencesUrl: string;
  labels?: TaskAssignedLabels;
  baseLabels?: EmailBaseLabels;
}

export function TaskAssignedEmail({
  title,
  body,
  taskName,
  workflowName,
  dueDate,
  ctaUrl,
  preferencesUrl,
  labels,
  baseLabels,
}: TaskAssignedEmailProps) {
  const l = {
    task: labels?.task ?? 'Task',
    workflow: labels?.workflow ?? 'Workflow',
    due: labels?.due ?? 'Due',
  };

  return (
    <BaseLayout
      ctaUrl={ctaUrl}
      ctaLabel={baseLabels?.ctaLabel}
      managePrefsLabel={baseLabels?.managePrefsLabel}
      unsubscribeLabel={baseLabels?.unsubscribeLabel}
      footerText={baseLabels?.footerText}
      preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{title}</Text>
      <Text style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: '24px' }}>{body}</Text>
      {!!taskName && (
        <Text style={{ fontSize: '14px', color: '#6b7280' }}>
          <strong>{l.task}:</strong> {taskName}
          {!!workflowName && (
            <>
              <br />
              <strong>{l.workflow}:</strong> {workflowName}
            </>
          )}
          {!!dueDate && (
            <>
              <br />
              <strong>{l.due}:</strong> {dueDate}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default TaskAssignedEmail;
