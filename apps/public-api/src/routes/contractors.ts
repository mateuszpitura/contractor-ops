import { publicApiContractorListInputSchema } from '@contractor-ops/validators/public-api';
import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';
import { parseListQuery } from '../lib/parse-list-query.js';

const contractors = new Hono();

/**
 * GET /contractors
 * List contractors with pagination and optional filters.
 */
contractors.get('/', async c => {
  const caller = createPublicCaller(c);
  const input = parseListQuery(publicApiContractorListInputSchema, c.req.query());

  const result = await caller.contractor.list(input);

  return c.json({
    data: result.items,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
});

/**
 * GET /contractors/:id
 * Get a single contractor by ID.
 */
contractors.get('/:id', async c => {
  const caller = createPublicCaller(c);
  const result = await caller.contractor.getById({ id: c.req.param('id') });
  return c.json({ data: result });
});

export default contractors;
