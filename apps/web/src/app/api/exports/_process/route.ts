/**
 * QStash consumer for the async export framework (P2-F · F-SCALE-01,
 * F-SCALE-02, F-SCALE-08).
 *
 * Triggered by the producer-side `requestExport` helper after a new row
 * has been inserted in PENDING. Claims the row atomically (PENDING →
 * PROCESSING), runs the registered handler, uploads the artefact to R2,
 * and either marks READY (+emails the user a download link) or FAILED
 * (with a truncated error message and metric).
 *
 * QStash signature is verified via `verifySignatureAppRouter` so the
 * route can't be invoked by anything other than our own dispatch.
 */

import {
  claimExport,
  runExportHandler,
} from '@contractor-ops/api/services/exports';
import { createCronLogger } from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createCronLogger('exports-process');

const bodySchema = z.object({
  exportId: z.string().min(1),
  organizationId: z.string().min(1),
});

async function handler(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { exportId } = parsed.data;

  let claim;
  try {
    claim = await claimExport(exportId);
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), exportId },
      'export claim failed',
    );
    // Return 500 so QStash retries — claim failure is usually transient
    // (Neon hiccup) and a retry should succeed.
    return NextResponse.json({ error: 'claim failed' }, { status: 500 });
  }

  if (!claim) {
    // Row vanished — most likely because the cron retention sweep deleted
    // it before the QStash callback fired. Treat as success so QStash
    // doesn't retry indefinitely.
    log.warn({ exportId }, 'export row not found — skipping');
    return NextResponse.json({ skipped: true });
  }

  if (claim.alreadyProcessed) {
    log.info({ exportId }, 'export already processed — skipping');
    return NextResponse.json({ skipped: true });
  }

  try {
    await runExportHandler(claim);
    return NextResponse.json({ processed: true });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), exportId },
      'export handler failed',
    );
    // Return 500 so QStash retries per its configured policy. The handler
    // already marked the row FAILED with the error message; on retry the
    // claim guard will short-circuit (status != PENDING) and we'll skip.
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
