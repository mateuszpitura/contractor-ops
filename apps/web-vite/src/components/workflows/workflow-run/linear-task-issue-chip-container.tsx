import { useLinearTaskIssueChip } from '../hooks/use-linear-task-issue-chip.js';
import { LinearTaskIssueChipView } from './linear-task-issue-chip.js';

interface LinearTaskIssueChipProps {
  taskRunId: string;
}

export function LinearTaskIssueChip({ taskRunId }: LinearTaskIssueChipProps) {
  const props = useLinearTaskIssueChip(taskRunId);
  return <LinearTaskIssueChipView {...props} />;
}
