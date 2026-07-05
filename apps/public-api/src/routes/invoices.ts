import {
  publicApiInvoiceCreateInputSchema,
  publicApiInvoiceListInputSchema,
  publicApiInvoiceVoidInputSchema,
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

const invoices = new OpenAPIHono();

const invoiceItem = z
  .object({
    id: z.string(),
    invoiceNumber: z.string().nullable(),
    issueDate: z.string(),
    dueDate: z.string().nullable(),
    currency: z.string(),
    subtotalMinor: z.number().nullable(),
    vatAmountMinor: z.number().nullable(),
    totalMinor: z.number().nullable(),
    amountToPayMinor: z.number().nullable(),
    sellerTaxId: z.string().nullable(),
    sellerName: z.string().nullable(),
    status: z.string(),
    matchStatus: z.string(),
    source: z.string(),
    contractorId: z.string().nullable(),
    contractId: z.string().nullable(),
    isReverseCharge: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicInvoice');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiInvoiceListInputSchema) },
  responses: {
    200: listOkResponse(invoiceItem, 'Cursor page of invoices'),
    ...errorResponses,
  },
});

invoices.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.invoice.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: itemOkResponse(invoiceItem, 'A single invoice with contractor and contract details'),
    ...errorResponses,
  },
});

invoices.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.invoice.getById({ id });
  return c.json({ data: result }, 200);
});

// --- Hidden write routes (double-dark) ---

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  hide: true,
  request: { body: jsonBody(publicApiInvoiceCreateInputSchema) },
  responses: writeResponses,
});

invoices.openapi(createRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).invoice.create(body);
  return c.json({ data: result }, 200);
});

const voidRouteDef = createRoute({
  method: 'patch',
  path: '/void',
  hide: true,
  request: { body: jsonBody(publicApiInvoiceVoidInputSchema) },
  responses: writeResponses,
});

invoices.openapi(voidRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).invoice.void(body);
  return c.json({ data: result }, 200);
});

export default invoices;
