import { deletePortalSession } from '@contractor-ops/api/services/portal-session';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createLogger({ service: 'portal-clear-session' });

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/portal/clear-session
 *
 * Clears the portal_session cookie and deletes the session from the database.
 * Called by the portal top bar and mobile menu logout buttons.
 */
export async function POST(req: NextRequest) {
  try {
    // Delete session from database if cookie exists
    const sessionToken = req.cookies.get('portal_session')?.value;
    if (sessionToken) {
      await deletePortalSession(sessionToken);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('portal_session');
    return response;
  } catch (err) {
    // F-OBS-13 — even though we deliberately swallow this so the user is
    // logged out client-side, log + capture so a DB-side outage manifests
    // as a Sentry breadcrumb (was previously invisible until the next time
    // the deleted session was re-checked).
    log.warn({ err }, 'failed to delete portal session DB row; clearing cookie anyway');
    Sentry.captureException(err, { tags: { 'portal.flow': 'clear_session' } });
    const response = NextResponse.json({ success: true });
    response.cookies.delete('portal_session');
    return response;
  }
}
