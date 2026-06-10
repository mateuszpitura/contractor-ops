import { publicApiInvoiceListInputSchema } from '@contractor-ops/validators/public-api';
import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';
import { parseListQuery } from '../lib/parse-list-query.js';

const invoices = new Hono();

/**
 * GET /invoices
 * List invoices with pagination and optional filters.
 */
invoices.get('/', async c => {
  const caller = createPublicCaller(c);
  const input = parseListQuery(publicApiInvoiceListInputSchema, c.req.query());

  const result = await caller.invoice.list(input);

  return c.json({
    data: result.items,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
});

/**
 * GET /invoices/:id
 * Get a single invoice by ID with contractor and contract details.
 */
invoices.get('/:id', async c => {
  const caller = createPublicCaller(c);
  const result = await caller.invoice.getById({ id: c.req.param('id') });
  return c.json({ data: result });
});

export default invoices;
