import {
  publicApiPaymentListInputSchema,
  publicApiPaymentUpdateInputSchema,
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

const payments = new OpenAPIHono();

const paymentItem = z
  .object({
    id: z.string(),
    paymentRunId: z.string(),
    invoiceId: z.string(),
    contractorId: z.string(),
    currency: z.string(),
    status: z.string(),
    grossAmountMinor: z.number().nullable(),
    whtAmountMinor: z.number().nullable(),
    paymentReference: z.string().nullable(),
    markedPaidAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicPayment');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiPaymentListInputSchema) },
  responses: { 200: listOkResponse(paymentItem, 'Cursor page of payments'), ...errorResponses },
});

payments.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.payment.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: itemOkResponse(paymentItem, 'A single payment'), ...errorResponses },
});

payments.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.payment.getById({ id });
  return c.json({ data: result }, 200);
});

// --- Hidden write route (double-dark) ---

const updateRouteDef = createRoute({
  method: 'patch',
  path: '/',
  hide: true,
  request: { body: jsonBody(publicApiPaymentUpdateInputSchema) },
  responses: writeResponses,
});

payments.openapi(updateRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).payment.update(body);
  return c.json({ data: result }, 200);
});

export default payments;
