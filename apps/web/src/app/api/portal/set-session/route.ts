import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const setSessionSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  expiresAt: z.string().min(1, 'Expiration date is required'),
  signature: z.string().min(1, 'Signature is required'),
});

// ---------------------------------------------------------------------------
// Signature verification (F-SEC-09)
// ---------------------------------------------------------------------------

/**
 * Recompute the server-side HMAC over `(token, expiresAt)` and compare it to
 * the value the client posted. The expected helper lives in
 * `packages/api/src/routers/portal/portal.ts` (`signPortalSessionToken`) — both
 * implementations MUST stay byte-identical.
 *
 * Domain-separator label `portal-set-session-v1` and key derivation
 * (`${BETTER_AUTH_SECRET}|portal-set-session-v1`) are intentionally fixed; do
 * not change without bumping the label and updating the matching signer.
 */
function expectedSignature(token: string, expiresAt: string): string {
  const secret = getServerEnv().BETTER_AUTH_SECRET;
  return createHmac('sha256', `${secret}|portal-set-session-v1`)
    .update(`${token}.${expiresAt}`)
    .digest('base64url');
}

function signaturesMatch(provided: string, expected: string): boolean {
  // Convert both to fixed-length Buffers so timingSafeEqual cannot leak
  // length differences (and never throw when lengths differ).
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/portal/set-session
 *
 * Sets the portal_session cookie as httpOnly.
 * Called by the verify page after successful magic link verification
 * or org selection.
 *
 * F-SEC-09 hardening:
 * - Requires an HMAC `signature` minted by the originating tRPC mutation
 *   (`portal.verifyMagicLink` or `portal.selectOrg`). Without it, this route
 *   would happily plant any body-supplied token as a cookie — a CSRF /
 *   session-fixation primitive (an attacker who obtains a valid token via any
 *   side channel could silently set it on a victim's browser).
 * - Returns 401 (not 400) on signature mismatch so the failure is visible in
 *   auth-failure metrics and rate-limit counters.
 *
 * Cookie security:
 * - httpOnly: true (prevents XSS access to session token)
 * - secure: true in production (HTTPS only)
 * - sameSite: strict (CSRF protection on the cookie itself)
 * - path: / (available to all routes)
 * - expires: set from the session expiry (7-day duration)
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = setSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { token, expiresAt, signature } = parsed.data;

  // F-SEC-09: verify HMAC before doing anything else. Reject with 401 so
  // surveillance dashboards see this as an auth failure, not a validation one.
  const expected = expectedSignature(token, expiresAt);
  if (!signaturesMatch(signature, expected)) {
    return NextResponse.json({ error: 'Invalid session signature' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('portal_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });

  return response;
}
