/**
 * Wave-0 RED contract (INTEG-API-04) — opaque cursor + bracket filter/sort.
 *
 * Asserts the pagination substrate 98-05 builds:
 *   - opaque base64url `{v,id}` cursor round-trips; a tampered token → BAD_REQUEST
 *     (never a silent wrong page).
 *   - the Hono boundary parses `filter[field]=` into a nested `{filter:{...}}`
 *     object and passes `cursor`/`limit`/`sort` through, so a `.strict()` list
 *     schema can reject unknown filter fields.
 *
 * RED until 98-05 adds `../lib/openapi-cursor` + `parseBracketedQuery`. Terminal
 * Cannot-find-module on the missing lib is the accepted Wave-0 state.
 */

import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
// RED: these modules/exports do not exist yet (added in 98-05).
import { decodeCursor, encodeCursor } from '../lib/openapi-cursor.js';
import { parseBracketedQuery } from '../lib/parse-list-query.js';

describe('opaque cursor', () => {
  it('round-trips an id through encode/decode', () => {
    const id = 'ckv_row_123';
    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });

  it('returns undefined for an empty token', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('throws BAD_REQUEST for a tampered/garbage token', () => {
    expect(() => decodeCursor('not-a-real-cursor!!')).toThrow(TRPCError);
    try {
      decodeCursor('###');
    } catch (e) {
      expect((e as TRPCError).code).toBe('BAD_REQUEST');
    }
  });
});

describe('parseBracketedQuery', () => {
  it('nests filter[field]= into a filter object and passes cursor/limit/sort through', () => {
    const out = parseBracketedQuery({
      'filter[status]': 'ACTIVE',
      cursor: 'abc',
      limit: '25',
      sort: '-createdAt',
    });
    expect(out).toMatchObject({
      filter: { status: 'ACTIVE' },
      cursor: 'abc',
      limit: '25',
      sort: '-createdAt',
    });
  });
});
