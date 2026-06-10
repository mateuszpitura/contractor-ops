import { LinearIssueChip } from '../../integrations/linear-issue-chip.js';
import type { LinearTaskIssueChipModel } from '../hooks/use-linear-task-issue-chip.js';
import { useLinearTaskIssueChip } from '../hooks/use-linear-task-issue-chip.js';

interface LinearTaskIssueChipViewProps {
  chip: LinearTaskIssueChipModel;
}

/**
 * Presentational Linear issue chip for a workflow task run.
 * The container guarantees `chip` is non-null; this view is a single render path.
 */
export function LinearTaskIssueChipView({ chip }: LinearTaskIssueChipViewProps) {
  return (
    <LinearIssueChip
      identifier={chip.identifier}
      title={chip.title}
      status={chip.status}
      statusType={chip.statusType}
      url={chip.url}
    />
  );
}

interface LinearTaskIssueChipProps {
  taskRunId: string;
}

export function LinearTaskIssueChip({ taskRunId }: LinearTaskIssueChipProps) {
  const { chip } = useLinearTaskIssueChip(taskRunId);
  if (!chip) return null;
  return <LinearTaskIssueChipView chip={chip} />;
}
