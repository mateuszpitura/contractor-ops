import {
  entityIdSchema,
  publicApiContractorCreateInputSchema,
  publicApiContractorListInputSchema,
  publicApiContractorUpdateInputSchema,
} from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { decodeCursor } from '../lib/openapi-cursor.js';
import {
  createPublicCaller,
  envelope,
  errorResponses,
  itemOkResponse,
  jsonBody,
  listOkResponse,
  listQuery,
  writeResponses,
} from '../lib/openapi-route.js';

const contractors = new OpenAPIHono();

const contractorItem = z
  .object({
    id: z.string(),
    legalName: z.string(),
    displayName: z.string().nullable(),
    type: z.string(),
    taxId: z.string().nullable(),
    vatId: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    countryCode: z.string().nullable(),
    currency: z.string().nullable(),
    status: z.string(),
    lifecycleStage: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicContractor');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiContractorListInputSchema) },
  responses: {
    200: listOkResponse(contractorItem, 'Cursor page of contractors'),
    ...errorResponses,
  },
});

contractors.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.contractor.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: itemOkResponse(contractorItem, 'A single contractor'),
    ...errorResponses,
  },
});

contractors.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.contractor.getById(entityIdSchema.parse({ id }));
  return c.json({ data: result }, 200);
});

// --- Hidden write routes (double-dark: hide:true keeps them out of the spec/SDK;
//     the tRPC layer inherits the per-org flag gate + scope check + tier quota) ---

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  hide: true,
  request: { body: jsonBody(publicApiContractorCreateInputSchema) },
  responses: writeResponses,
});

contractors.openapi(createRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).contractor.create(body);
  return c.json({ data: result }, 200);
});

const updateRouteDef = createRoute({
  method: 'patch',
  path: '/',
  hide: true,
  request: { body: jsonBody(publicApiContractorUpdateInputSchema) },
  responses: writeResponses,
});

contractors.openapi(updateRouteDef, async c => {
  const body = c.req.valid('json');
  const result = await createPublicCaller(c).contractor.update(body);
  return c.json({ data: result }, 200);
});

export default contractors;
