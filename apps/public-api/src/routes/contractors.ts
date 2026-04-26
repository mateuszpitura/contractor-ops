import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';

const contractors = new Hono();

/**
 * GET /contractors
 * List contractors with pagination and optional filters.
 */
contractors.get('/', async c => {
  const caller = createPublicCaller(c);
  const query = c.req.query();

  const result = await caller.contractor.list({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    status: query.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | undefined,
    lifecycleStage: query.lifecycleStage as
      | 'DRAFT'
      | 'ONBOARDING'
      | 'ACTIVE'
      | 'OFFBOARDING'
      | 'ENDED'
      | undefined,
    sortBy: query.sortBy as 'legalName' | 'createdAt' | 'updatedAt' | undefined,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
  });

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
