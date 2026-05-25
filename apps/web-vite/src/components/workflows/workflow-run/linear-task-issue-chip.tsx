import { LinearIssueChip } from '../../integrations/linear-issue-chip.js';
import type { useLinearTaskIssueChip } from '../hooks/use-linear-task-issue-chip.js';

type LinearTaskIssueChipViewProps = ReturnType<typeof useLinearTaskIssueChip>;

/**
 * Presentational Linear issue chip for a workflow task run.
 * Renders nothing when the integration is disconnected or no issue is linked.
 */
export function LinearTaskIssueChipView({ chip }: LinearTaskIssueChipViewProps) {
  if (!chip) return null;

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
