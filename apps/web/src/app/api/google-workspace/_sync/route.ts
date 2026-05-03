import { processDirectorySync } from '@contractor-ops/api/services/google-workspace-sync-orchestrator';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import {
  buildContextFromHeaders,
  createCronLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createCronLogger('google-workspace-sync');

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// Request body validation (CLAUDE.md: validate all external inputs)
// ---------------------------------------------------------------------------

const syncRequestBodySchema = z.object({
  organizationId: z.string().min(1),
  connectionId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/google-workspace/_sync
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for periodic and manual Google Workspace directory sync.
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY,
 * QSTASH_NEXT_SIGNING_KEY).
 *
 * Called by:
 * - Daily cron schedule (created on Google Workspace connect, per D-12: 2 AM org timezone)
 * - Manual "Sync Now" trigger via tRPC googleWorkspace.triggerSync
 *
 * Flow:
 * 1. QStash verifies its own signature (via verifySignatureAppRouter wrapper)
 * 2. Parse and validate organizationId + connectionId from body via Zod
 * 3. Call processDirectorySync to compare directory, detect changes, notify admins
 * 4. Return 200 on success, 500 on error (QStash retries on non-2xx)
 */
async function handler(request: NextRequest) {
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  const ctx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(ctx, async () => {
    const parseResult = syncRequestBodySchema.safeParse(await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { organizationId, connectionId } = parseResult.data;

    try {
      const result = await processDirectorySync({ organizationId, connectionId });
      return NextResponse.json({ processed: true, ...result });
    } catch (error) {
      log.error({ err: error, organizationId }, 'failed to sync directory for org');
      return NextResponse.json(
        { error: 'Google Workspace directory sync failed' },
        { status: 500 },
      );
    }
  });
}

// Wrap with QStash signature verification
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
