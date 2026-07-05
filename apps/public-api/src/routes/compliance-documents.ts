import { publicApiComplianceDocumentListInputSchema } from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  itemOkResponse,
  listOkResponse,
  listQuery,
} from '../lib/openapi-route.js';

const complianceDocuments = new OpenAPIHono();

const complianceDocumentItem = z
  .object({
    id: z.string(),
    classificationAssessmentId: z.string(),
    kind: z.string(),
    sha256Hash: z.string(),
    generatedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicComplianceDocument');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiComplianceDocumentListInputSchema) },
  responses: {
    200: listOkResponse(complianceDocumentItem, 'Cursor page of compliance documents'),
    ...errorResponses,
  },
});

complianceDocuments.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.complianceDocument.list({
    ...input,
    cursor: decodeCursor(input.cursor),
  });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: itemOkResponse(complianceDocumentItem, 'A single compliance document'),
    ...errorResponses,
  },
});

complianceDocuments.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.complianceDocument.getById({ id });
  return c.json({ data: result }, 200);
});

export default complianceDocuments;
