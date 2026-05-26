export const WORKFLOW_STATUSES = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export const WORKFLOW_STATUS_VALUES = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
  'SKIPPED',
  'CANCELLED',
] as const;

export type WorkflowStatusValue = (typeof WORKFLOW_STATUS_VALUES)[number];
