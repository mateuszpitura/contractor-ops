import { processKsefSync } from '@contractor-ops/api/services/ksef-sync-orchestrator';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createCronLogger('ksef-sync');

const ksefSyncBodySchema = z.object({
  organizationId: z.string().min(1),
  connectionId: z.string().min(1),
});

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
  const rawBody = await request.json().catch(() => null);
  const parsed = ksefSyncBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { organizationId, connectionId } = parsed.data;

  try {
    const result = await processKsefSync({ organizationId, connectionId });
    return NextResponse.json({ processed: true, ...result });
  } catch (error) {
    log.error({ err: error, organizationId }, 'ksef sync failed');
    return NextResponse.json({ error: 'KSeF sync failed' }, { status: 500 });
  }
}

// Wrap with QStash signature verification
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
