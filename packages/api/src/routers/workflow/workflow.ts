/**
 * Workflow router — combines template management and execution runtime.
 *
 * Sub-routers:
 * - workflow-templates.ts — template CRUD, duplication, starter seeding
 * - workflow-execution.ts — run lifecycle, task actions, comments, overdue count
 *
 * Shared utilities (condition evaluation, progress calculation, assignee resolution)
 * live in workflow-shared.ts and are re-exported here for external consumers.
 */
import { mergeRouters, router } from '../../init';
import { credentialReferenceRouter } from './credential-reference';
import { workflowExecutionRouter } from './workflow-execution';
import { workflowTemplatesRouter } from './workflow-templates';

// ---------------------------------------------------------------------------
// Re-export shared utilities for external consumers (e.g., tests, services)
// ---------------------------------------------------------------------------

export {
  calculateProgress,
  evaluateCondition,
  resolveAssignee,
  TASK_TRANSITIONS,
} from './workflow-shared';

// ---------------------------------------------------------------------------
// Merged workflow router
// ---------------------------------------------------------------------------

// Phase 75 D-10 — `workflow.credentialReference.*` namespace (NOT flattened into
// the merged procedure map). mergeRouters flattens; wrapping the credential
// router in `router({ credentialReference })` keeps it a nested namespace.
export const workflowRouter = mergeRouters(
  workflowTemplatesRouter,
  workflowExecutionRouter,
  router({ credentialReference: credentialReferenceRouter }),
);
