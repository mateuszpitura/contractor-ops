import { publicListMetaSchema } from '@contractor-ops/validators/public-api';
import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { createPublicCaller } from './create-caller.js';
import { encodeCursor } from './openapi-cursor.js';
import { parseBracketedQuery } from './parse-list-query.js';

/**
 * Shared building blocks for the public REST `createRoute` definitions so every
 * read route is assembly, not boilerplate.
 */

/** Standard error responses documented on every authenticated route. */
export const errorResponses = {
  401: { description: 'Invalid or missing API key' },
  403: { description: 'Insufficient scope or tier' },
  404: { description: 'Not found, or the public API module is disabled for this org' },
} as const;

/**
 * Wraps a per-entity `.strict()` list DTO so the `createRoute` request.query
 * validation reconstructs `filter[field]=` bracket params into the nested
 * `{ filter: {...} }` object BEFORE `.strict()` runs. The params
 * still surface in the OpenAPI spec.
 *
 * At runtime this is a `z.preprocess(...)` wrapper; the return type is cast back
 * to the DTO so `createRoute` accepts it as `request.query` and `c.req.valid`
 * infers the nested (post-preprocess) shape.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic over any ZodObject DTO.
export function listQuery<T extends z.ZodObject<any>>(dto: T): T {
  return z.preprocess(parseBracketedQuery, dto) as unknown as T;
}

/** The `{ data, meta }` cursor envelope schema for a given item schema. */
export function listEnvelope<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), meta: publicListMetaSchema });
}

/** A 200 JSON response spec for a cursor list of `item`. */
export function listOkResponse<T extends z.ZodTypeAny>(item: T, description: string) {
  return {
    content: { 'application/json': { schema: listEnvelope(item) } },
    description,
  };
}

/** A 200 JSON response spec for a single `item` (getById). */
export function itemOkResponse<T extends z.ZodTypeAny>(item: T, description: string) {
  return {
    content: { 'application/json': { schema: z.object({ data: item }) } },
    description,
  };
}

/** A JSON request body spec for a write route, bound to a `.strict()` write DTO. */
// biome-ignore lint/suspicious/noExplicitAny: generic over any Zod write DTO.
export function jsonBody<T extends z.ZodType<any, any, any>>(schema: T) {
  return { content: { 'application/json': { schema } }, required: true };
}

/**
 * The documented responses for a hidden write route: the read error set plus
 * 400 (bad body) and 429 (tier quota). The result shape is opaque here — writes
 * are `hide:true`, so this never surfaces in the derived spec.
 */
export const writeResponses = {
  200: {
    content: { 'application/json': { schema: z.object({ data: z.unknown() }) } },
    description: 'Write result',
  },
  400: { description: 'Invalid request body' },
  429: { description: 'Rate limit or monthly quota exceeded' },
  ...errorResponses,
} as const;

/**
 * Emits the standard cursor envelope from a tRPC list result, encoding the
 * plain-id nextCursor into an opaque token.
 */
export function envelope<T>(c: Context, result: { items: T[]; nextCursor?: string | undefined }) {
  const { items, nextCursor } = result;
  return c.json(
    {
      data: items,
      meta: {
        nextCursor: nextCursor ? encodeCursor(nextCursor) : null,
        hasMore: nextCursor != null,
      },
    },
    200,
  );
}

export { createPublicCaller };
