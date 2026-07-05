import { publicApiAuditLogListInputSchema } from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  listOkResponse,
  listQuery,
} from '../lib/openapi-route.js';

const auditLog = new OpenAPIHono();

// PII-aware: actor identity + raw value/metadata JSON are NOT exposed.
const auditLogItem = z
  .object({
    id: z.string(),
    actorType: z.string(),
    action: z.string(),
    resourceType: z.string(),
    resourceId: z.string(),
    createdAt: z.string(),
  })
  .openapi('PublicAuditLogEntry');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiAuditLogListInputSchema) },
  responses: {
    200: listOkResponse(auditLogItem, 'Cursor page of audit-log entries'),
    ...errorResponses,
  },
});

auditLog.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.audit.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

export default auditLog;
