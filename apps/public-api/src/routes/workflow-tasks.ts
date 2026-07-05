import {
  publicApiWorkflowTaskListInputSchema,
  publicApiWorkflowTaskTransitionInputSchema,
} from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  itemOkResponse,
  jsonBody,
  listOkResponse,
  listQuery,
  writeResponses,
} from '../lib/openapi-route.js';

const workflowTasks = new OpenAPIHono();

const workflowTaskItem = z
  .object({
    id: z.string(),
    workflowRunId: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    assigneeRole: z.string().nullable(),
    dueAt: z.string().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    dependsOnTaskRunId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicWorkflowTask');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiWorkflowTaskListInputSchema) },
  responses: {
    200: listOkResponse(workflowTaskItem, 'Cursor page of workflow tasks'),
    ...errorResponses,
  },
});

workflowTasks.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.workflowTask.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: itemOkResponse(workflowTaskItem, 'A single workflow task'), ...errorResponses },
});

workflowTasks.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.workflowTask.getById({ id });
  return c.json({ data: result }, 200);
});

// --- Hidden write route (double-dark) ---

const transitionRouteDef = createRoute({
  method: 'patch',
  path: '/transition',
  hide: true,
  request: { body: jsonBody(publicApiWorkflowTaskTransitionInputSchema) },
  responses: writeResponses,
});

workflowTasks.openapi(transitionRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).workflowTask.transition(body);
  return c.json({ data: result }, 200);
});

export default workflowTasks;
