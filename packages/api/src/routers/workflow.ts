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
import { mergeRouters } from "../init.js";
import { workflowExecutionRouter } from "./workflow-execution.js";
import { workflowTemplatesRouter } from "./workflow-templates.js";

// ---------------------------------------------------------------------------
// Re-export shared utilities for external consumers (e.g., tests, services)
// ---------------------------------------------------------------------------

export {
  calculateProgress,
  evaluateCondition,
  resolveAssignee,
  TASK_TRANSITIONS,
} from "./workflow-shared.js";

// ---------------------------------------------------------------------------
// Merged workflow router
// ---------------------------------------------------------------------------

export const workflowRouter = mergeRouters(workflowTemplatesRouter, workflowExecutionRouter);
