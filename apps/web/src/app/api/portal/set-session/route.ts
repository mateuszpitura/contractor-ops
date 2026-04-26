import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const setSessionSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  expiresAt: z.string().min(1, 'Expiration date is required'),
});

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
 * Security:
 * - httpOnly: true (prevents XSS access to session token)
 * - secure: true in production (HTTPS only)
 * - sameSite: lax (CSRF protection)
 * - path: / (available to all routes)
 * - expires: set from the session expiry (7-day duration)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = setSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { token, expiresAt } = parsed.data;
    const response = NextResponse.json({ success: true });

    response.cookies.set('portal_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: new Date(expiresAt),
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to set session' }, { status: 500 });
  }
}
