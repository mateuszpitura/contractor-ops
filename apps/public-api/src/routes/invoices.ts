import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';

const invoices = new Hono();

/**
 * GET /invoices
 * List invoices with pagination and optional filters.
 */
invoices.get('/', async c => {
  const caller = createPublicCaller(c);
  const query = c.req.query();

  const result = await caller.invoice.list({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    status: query.status as
      | 'RECEIVED'
      | 'UNDER_REVIEW'
      | 'APPROVED'
      | 'SCHEDULED'
      | 'PAID'
      | 'VOID'
      | 'REJECTED'
      | undefined,
    contractorId: query.contractorId,
    sortBy: query.sortBy as 'issueDate' | 'dueDate' | 'createdAt' | 'totalMinor' | undefined,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
  });

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
