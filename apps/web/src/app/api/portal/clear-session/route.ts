import { deletePortalSession } from "@contractor-ops/api/services/portal-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
    const sessionToken = req.cookies.get("portal_session")?.value;
    if (sessionToken) {
      await deletePortalSession(sessionToken);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("portal_session");
    return response;
  } catch {
    // Even if DB deletion fails, clear the cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete("portal_session");
    return response;
  }
}
