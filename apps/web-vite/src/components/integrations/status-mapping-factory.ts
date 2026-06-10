/**
 * Parameterised factory for Jira/Linear workflow status mapping hooks.
 * Provider-specific hooks supply TRPC query/mutation keys; this module owns shared state shape.
 */

export type WorkflowStatusMappingEntry = {
  workflowStatus: string;
  externalTransitionId: string;
  externalTransitionName: string;
  externalTargetStatusName: string;
  externalTargetStatusCategory: 'new' | 'indeterminate' | 'done';
};

export type StatusMappingDialogParams = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
};

export type StatusMappingProject = {
  id: string;
  key: string;
  name: string;
};

export function createEmptyMappings(workflowStatuses: readonly string[]): WorkflowStatusMappingEntry[] {
  return workflowStatuses.map(workflowStatus => ({
    workflowStatus,
    externalTransitionId: '',
    externalTransitionName: '',
    externalTargetStatusName: '',
    externalTargetStatusCategory: 'indeterminate',
  }));
}

export function mappingsDirty(
  current: WorkflowStatusMappingEntry[],
  initial: WorkflowStatusMappingEntry[],
): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}
