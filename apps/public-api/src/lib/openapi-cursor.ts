import { TRPCError } from '@trpc/server';

/**
 * Opaque, stateless, versioned pagination cursor for the public REST API.
 *
 * The internal keyset pagination (`packages/api/src/lib/pagination.ts`) uses the
 * row id as the cursor. Publicly we wrap that id in a base64url-encoded envelope
 * so consumers treat it as an opaque token (no enumeration, no coupling to the
 * id format) and a tampered/garbage token is rejected with BAD_REQUEST rather
 * than silently returning a wrong page.
 */

interface CursorPayload {
  v: 1;
  id: string;
}

/** Encode a row id into an opaque base64url cursor token. */
export function encodeCursor(id: string): string {
  const payload: CursorPayload = { v: 1, id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decode an opaque cursor token back to the row id. Returns `undefined` for an
 * absent token (first page). Throws `TRPCError({ code: 'BAD_REQUEST' })` for a
 * tampered/garbage token so the boundary maps it to a clean 400.
 */
export function decodeCursor(token?: string): string | undefined {
  if (!token) return;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { v?: unknown }).v === 1 &&
      typeof (parsed as { id?: unknown }).id === 'string'
    ) {
      return (parsed as CursorPayload).id;
    }
    // safe-swallow: malformed cursor token is a client error — falls through to the BAD_REQUEST below
  } catch {
    // fall through to the shared BAD_REQUEST below
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_CURSOR' });
}
