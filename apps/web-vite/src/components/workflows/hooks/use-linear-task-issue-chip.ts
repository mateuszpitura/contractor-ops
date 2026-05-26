import { useWorkflowLinearIssue } from './use-workflow-ui.js';

type LinearStatusType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export interface LinearTaskIssueChipModel {
  identifier: string;
  title: string;
  status: string;
  statusType: LinearStatusType;
  url: string;
}

export function useLinearTaskIssueChip(taskRunId: string) {
  const { connectionQuery, linkedQuery } = useWorkflowLinearIssue(taskRunId);

  const connected = !!connectionQuery.data;
  const link = linkedQuery.data;
  const metadata =
    (link?.metadata as
      | {
          identifier?: string;
          title?: string;
          status?: string;
          statusType?: LinearStatusType;
          url?: string;
        }
      | null
      | undefined) ?? null;

  const chip: LinearTaskIssueChipModel | null =
    connected &&
    link &&
    metadata?.identifier &&
    metadata.title &&
    metadata.status &&
    metadata.statusType
      ? {
          identifier: metadata.identifier,
          title: metadata.title,
          status: metadata.status,
          statusType: metadata.statusType,
          url: metadata.url ?? link.externalUrl ?? '#',
        }
      : null;

  return {
    chip,
  } as const;
}
