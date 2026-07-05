import { publicApiClassificationListInputSchema } from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  itemOkResponse,
  listOkResponse,
  listQuery,
} from '../lib/openapi-route.js';

const classifications = new OpenAPIHono();

const classificationItem = z
  .object({
    id: z.string(),
    countryCode: z.string(),
    status: z.string(),
    policyRuleSetVersion: z.string().nullable(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicClassification');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiClassificationListInputSchema) },
  responses: {
    200: listOkResponse(classificationItem, 'Cursor page of classification assessments'),
    ...errorResponses,
  },
});

classifications.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.classification.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: itemOkResponse(classificationItem, 'A single classification assessment'),
    ...errorResponses,
  },
});

classifications.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.classification.getById({ id });
  return c.json({ data: result }, 200);
});

export default classifications;
