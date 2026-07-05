import { publicApiDocumentListInputSchema } from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  listOkResponse,
  listQuery,
} from '../lib/openapi-route.js';

const documents = new OpenAPIHono();

const documentItem = z
  .object({
    id: z.string(),
    originalFileName: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number(),
    documentType: z.string(),
    status: z.string(),
    virusScanStatus: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicDocument');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiDocumentListInputSchema) },
  responses: {
    200: listOkResponse(documentItem, 'Cursor page of documents'),
    ...errorResponses,
  },
});

documents.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.document.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const downloadUrlItem = z
  .object({ url: z.string(), expiresIn: z.number() })
  .openapi('PublicDocumentDownloadUrl');

const downloadUrlRoute = createRoute({
  method: 'get',
  path: '/{id}/download-url',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ data: downloadUrlItem }) } },
      description: 'A short-lived presigned download URL for the document',
    },
    ...errorResponses,
  },
});

documents.openapi(downloadUrlRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.document.getDownloadUrl({ id });
  return c.json({ data: result }, 200);
});

export default documents;
