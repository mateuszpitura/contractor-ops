import { publicApiPaymentRunListInputSchema } from '@contractor-ops/validators/public-api';
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

const paymentRuns = new OpenAPIHono();

const paymentRunItem = z
  .object({
    id: z.string(),
    runNumber: z.string().nullable(),
    name: z.string().nullable(),
    status: z.string(),
    currency: z.string().nullable(),
    totalMinor: z.number(),
    invoiceCount: z.number(),
    exportFormat: z.string().nullable(),
    exportedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicPaymentRun');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiPaymentRunListInputSchema) },
  responses: {
    200: listOkResponse(paymentRunItem, 'Cursor page of payment runs'),
    ...errorResponses,
  },
});

paymentRuns.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.paymentRun.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: itemOkResponse(paymentRunItem, 'A single payment run'), ...errorResponses },
});

paymentRuns.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.paymentRun.getById({ id });
  return c.json({ data: result }, 200);
});

export default paymentRuns;
