import {
  publicApiWorkflowCreateInputSchema,
  publicApiWorkflowExecuteInputSchema,
  publicApiWorkflowListInputSchema,
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

const workflows = new OpenAPIHono();

const workflowItem = z
  .object({
    id: z.string(),
    contractorId: z.string().nullable(),
    contractId: z.string().nullable(),
    status: z.string(),
    startedAt: z.string().nullable(),
    dueAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    progressPercent: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicWorkflow');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiWorkflowListInputSchema) },
  responses: {
    200: listOkResponse(workflowItem, 'Cursor page of workflow runs'),
    ...errorResponses,
  },
});

workflows.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.workflow.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: itemOkResponse(workflowItem, 'A single workflow run'), ...errorResponses },
});

workflows.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.workflow.getById({ id });
  return c.json({ data: result }, 200);
});

// --- Write routes (live behind the per-org module.public-api flag gate) ---

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: { body: jsonBody(publicApiWorkflowCreateInputSchema) },
  responses: writeResponses,
});

workflows.openapi(createRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).workflow.create(body);
  return c.json({ data: result }, 200);
});

const executeRouteDef = createRoute({
  method: 'post',
  path: '/execute',
  request: { body: jsonBody(publicApiWorkflowExecuteInputSchema) },
  responses: writeResponses,
});

workflows.openapi(executeRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).workflow.execute(body);
  return c.json({ data: result }, 200);
});

export default workflows;
