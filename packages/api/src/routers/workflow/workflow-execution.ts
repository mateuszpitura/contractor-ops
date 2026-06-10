/**
 * Workflow execution router — merges run, task, and comment sub-routers.
 */

import { mergeRouters } from '../../init';
import { workflowExecutionCommentsRouter } from './workflow-execution-comments';
import { workflowExecutionRunsRouter } from './workflow-execution-runs';
import { workflowExecutionTasksRouter } from './workflow-execution-tasks';

export const workflowExecutionRouter = mergeRouters(
  workflowExecutionRunsRouter,
  workflowExecutionTasksRouter,
  workflowExecutionCommentsRouter,
);
