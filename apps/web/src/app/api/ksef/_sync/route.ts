import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { registerAllAdapters } from "@contractor-ops/integrations/adapters/register-all";
import { processKsefSync } from "@contractor-ops/api/services/ksef-sync-orchestrator";

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// POST /api/ksef/_sync
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for scheduled and manual KSeF sync.
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY,
 * QSTASH_NEXT_SIGNING_KEY).
 *
 * Called by:
 * - Hourly cron schedule (created on KSeF connect)
 * - Manual "Sync Now" trigger via tRPC
 *
 * Flow:
 * 1. QStash verifies its own signature (via verifySignatureAppRouter wrapper)
 * 2. Parse organizationId + connectionId from body
 * 3. Call processKsefSync to fetch, parse, create, and match invoices
 * 4. Return 200 on success, 500 on error (QStash retries on non-2xx)
 */
async function handler(request: NextRequest) {
  const body = await request.json();
  const { organizationId, connectionId } = body as {
    organizationId: string;
    connectionId: string;
  };

  if (!organizationId || !connectionId) {
    return NextResponse.json(
      { error: "Missing organizationId or connectionId" },
      { status: 400 },
    );
  }

  try {
    const result = await processKsefSync({ organizationId, connectionId });
    return NextResponse.json({ processed: true, ...result });
  } catch (error) {
    console.error(
      `[ksef/_sync] Failed to sync KSeF for org ${organizationId}:`,
      error,
    );
    return NextResponse.json(
      { error: "KSeF sync failed" },
      { status: 500 },
    );
  }
}

// Wrap with QStash signature verification
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
