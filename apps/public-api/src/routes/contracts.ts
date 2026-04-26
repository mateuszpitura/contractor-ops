import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';

const contracts = new Hono();

/**
 * GET /contracts
 * List contracts with pagination and optional filters.
 */
contracts.get('/', async c => {
  const caller = createPublicCaller(c);
  const query = c.req.query();

  const result = await caller.contract.list({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    status: query.status as
      | 'DRAFT'
      | 'PENDING_SIGNATURE'
      | 'ACTIVE'
      | 'EXPIRING'
      | 'EXPIRED'
      | 'TERMINATED'
      | 'SUPERSEDED'
      | 'ARCHIVED'
      | undefined,
    contractorId: query.contractorId,
    sortBy: query.sortBy as 'title' | 'startDate' | 'endDate' | 'createdAt' | undefined,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
  });

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
