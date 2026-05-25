import { useJiraTaskConfig } from './hooks/use-jira-task-config.js';
import { JiraTaskConfigView } from './jira-task-config.js';

interface JiraTaskConfigProps {
  taskTemplateId: string;
}

export function JiraTaskConfig({ taskTemplateId }: JiraTaskConfigProps) {
  const { connection, ...rest } = useJiraTaskConfig(taskTemplateId);
  if (!connection) return null;
  return <JiraTaskConfigView {...rest} connection={connection} />;
}
