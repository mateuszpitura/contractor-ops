import { publicApiContractListInputSchema } from '@contractor-ops/validators/public-api';
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

const contracts = new OpenAPIHono();

const contractItem = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    status: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    currency: z.string().nullable(),
    billingModel: z.string().nullable(),
    rateType: z.string().nullable(),
    rateValueMinor: z.number().nullable(),
    autoRenewal: z.boolean(),
    contractorId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PublicContract');

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: listQuery(publicApiContractListInputSchema) },
  responses: {
    200: listOkResponse(contractItem, 'Cursor page of contracts'),
    ...errorResponses,
  },
});

contracts.openapi(listRoute, async c => {
  const input = c.req.valid('query');
  const caller = createPublicCaller(c);
  const result = await caller.contract.list({ ...input, cursor: decodeCursor(input.cursor) });
  return envelope(c, result);
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: itemOkResponse(contractItem, 'A single contract with contractor details'),
    ...errorResponses,
  },
});

contracts.openapi(getByIdRoute, async c => {
  const { id } = c.req.valid('param');
  const caller = createPublicCaller(c);
  const result = await caller.contract.getById({ id });
  return c.json({ data: result }, 200);
});

export default contracts;
