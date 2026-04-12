/**
 * Maps public API sort keys (snake_case) to Prisma field names (camelCase).
 * Keeps query param / Zod enum values consistent across list endpoints.
 */

export type SortOrder = 'asc' | 'desc';

function orderByField(field: string, sortOrder: SortOrder): Record<string, SortOrder> {
  return { [field]: sortOrder };
}

// ---------------------------------------------------------------------------
// Invoice list
// ---------------------------------------------------------------------------

const INVOICE_LIST: Record<string, string> = {
  received_at: 'receivedAt',
  invoice_number: 'invoiceNumber',
  issue_date: 'issueDate',
  due_date: 'dueDate',
  total_minor: 'totalMinor',
  status: 'status',
};

export function invoiceListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = INVOICE_LIST[sortBy] ?? 'receivedAt';
  return orderByField(field, sortOrder);
}

// ---------------------------------------------------------------------------
// Contractor list
// ---------------------------------------------------------------------------

const CONTRACTOR_LIST: Record<string, string> = {
  created_at: 'createdAt',
  legal_name: 'legalName',
  status: 'status',
  lifecycle_stage: 'lifecycleStage',
  type: 'type',
};

export function contractorListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = CONTRACTOR_LIST[sortBy] ?? 'createdAt';
  return orderByField(field, sortOrder);
}

// ---------------------------------------------------------------------------
// Contract list
// ---------------------------------------------------------------------------

const CONTRACT_LIST: Record<string, string> = {
  created_at: 'createdAt',
  title: 'title',
  status: 'status',
  end_date: 'endDate',
  start_date: 'startDate',
  type: 'type',
};

export function contractListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = CONTRACT_LIST[sortBy] ?? 'endDate';
  return orderByField(field, sortOrder);
}

// ---------------------------------------------------------------------------
// Payment run list
// ---------------------------------------------------------------------------

const PAYMENT_RUN_LIST: Record<string, string> = {
  created_at: 'createdAt',
  run_number: 'runNumber',
  total_minor: 'totalMinor',
};

export function paymentRunListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = PAYMENT_RUN_LIST[sortBy] ?? 'createdAt';
  return orderByField(field, sortOrder);
}

// ---------------------------------------------------------------------------
// Equipment list
// ---------------------------------------------------------------------------

const EQUIPMENT_LIST: Record<string, string> = {
  name: 'name',
  type: 'type',
  status: 'status',
  created_at: 'createdAt',
};

export function equipmentListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = EQUIPMENT_LIST[sortBy] ?? 'createdAt';
  return orderByField(field, sortOrder);
}

// ---------------------------------------------------------------------------
// Workflow run list
// ---------------------------------------------------------------------------

const WORKFLOW_RUN_LIST: Record<string, string> = {
  created_at: 'createdAt',
  due_at: 'dueAt',
  status: 'status',
  started_at: 'startedAt',
};

export function workflowRunListOrderBy(sortBy: string, sortOrder: SortOrder) {
  const field = WORKFLOW_RUN_LIST[sortBy] ?? 'dueAt';
  return orderByField(field, sortOrder);
}
