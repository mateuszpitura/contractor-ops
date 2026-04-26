import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';

const documents = new Hono();

/**
 * GET /documents
 * List documents with pagination. Optionally filter by linked entity.
 */
documents.get('/', async c => {
  const caller = createPublicCaller(c);
  const query = c.req.query();

  const result = await caller.document.list({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    entityType: query.entityType as 'CONTRACTOR' | 'CONTRACT' | 'INVOICE' | undefined,
    entityId: query.entityId,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
  });

  return c.json({
    data: result.items,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
});

/**
 * GET /documents/:id/download-url
 * Get a presigned download URL for a document.
 */
documents.get('/:id/download-url', async c => {
  const caller = createPublicCaller(c);
  const result = await caller.document.getDownloadUrl({ id: c.req.param('id') });
  return c.json({ data: result });
});

export default documents;
