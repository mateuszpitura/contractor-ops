import { publicApiContractListInputSchema } from '@contractor-ops/validators/public-api';
import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';
import { parseListQuery } from '../lib/parse-list-query.js';

const contracts = new Hono();

/**
 * GET /contracts
 * List contracts with pagination and optional filters.
 */
contracts.get('/', async c => {
  const caller = createPublicCaller(c);
  const input = parseListQuery(publicApiContractListInputSchema, c.req.query());

  const result = await caller.contract.list(input);

  return c.json({
    data: result.items,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
});

/**
 * GET /contracts/:id
 * Get a single contract by ID with contractor details.
 */
contracts.get('/:id', async c => {
  const caller = createPublicCaller(c);
  const result = await caller.contract.getById({ id: c.req.param('id') });
  return c.json({ data: result });
});

export default contracts;
