import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refreshExpiring } from "@contractor-ops/integrations";

// ---------------------------------------------------------------------------
// GET /api/cron/token-refresh
// Vercel Cron endpoint — runs every 15 minutes to proactively refresh
// integration tokens expiring within 30 minutes.
// Protected by CRON_SECRET bearer token (set by Vercel for cron jobs).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshExpiring();
    console.log(
      `[token-refresh] Refreshed ${result.refreshed}/${result.total}, failed: ${result.failed}`,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[token-refresh] Cron error:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
