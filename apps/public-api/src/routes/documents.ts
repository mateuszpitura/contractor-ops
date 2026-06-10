import { publicApiDocumentListInputSchema } from '@contractor-ops/validators/public-api';
import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';
import { parseListQuery } from '../lib/parse-list-query.js';

const documents = new Hono();

/**
 * GET /documents
 * List documents with pagination. Optionally filter by linked entity.
 */
documents.get('/', async c => {
  const caller = createPublicCaller(c);
  const input = parseListQuery(publicApiDocumentListInputSchema, c.req.query());

  const result = await caller.document.list(input);

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
