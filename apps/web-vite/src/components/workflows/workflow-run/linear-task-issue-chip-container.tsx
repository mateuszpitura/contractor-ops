import { useLinearTaskIssueChip } from '../hooks/use-linear-task-issue-chip.js';
import { LinearTaskIssueChipView } from './linear-task-issue-chip.js';

interface LinearTaskIssueChipProps {
  taskRunId: string;
}

export function LinearTaskIssueChip({ taskRunId }: LinearTaskIssueChipProps) {
  const { chip } = useLinearTaskIssueChip(taskRunId);
  if (!chip) return null;
  return <LinearTaskIssueChipView chip={chip} />;
}
