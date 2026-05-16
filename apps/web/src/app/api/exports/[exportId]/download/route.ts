/**
 * Async export download route (P2-F · F-SCALE-01).
 *
 * Resolves an `Export` row, verifies the caller is a member of the owning
 * organisation, and 302-redirects to a freshly-signed R2 URL. Signing on
 * each click means the original "your export is ready" email link can
 * stay valid for the full 7-day retention window without leaking a
 * presigned URL into long-lived inboxes.
 *
 * Auth: Better Auth session must resolve, and the session's active org
 * must match `Export.organizationId` (defense-in-depth on top of Prisma
 * tenant scope).
 */

import { signExistingDownload } from '@contractor-ops/api/services/r2';
import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createLogger({ service: 'exports-download' });

const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 min — user has time to click but the URL doesn't loiter.

// Cache-Control: `no-store, private` — every response is per-user (session-
// scoped) and serves either a signed R2 URL or a JSON error envelope; neither
// is safe to cache at the CDN.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ exportId: string }> }) {
  const [{ exportId }, reqHeaders] = await Promise.all([context.params, headers()]);

  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session) {
    return withNoStore(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }));
  }
  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    return withNoStore(NextResponse.json({ error: 'no active organization' }, { status: 403 }));
  }

  const row = await prisma.export.findUnique({
    where: { id: exportId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      fileR2Key: true,
      fileName: true,
      mimeType: true,
      expiresAt: true,
    },
  });

  if (!row || row.organizationId !== activeOrgId) {
    return withNoStore(NextResponse.json({ error: 'not found' }, { status: 404 }));
  }

  if (row.status !== 'READY' || !row.fileR2Key) {
    return withNoStore(
      NextResponse.json({ error: 'export not ready', status: row.status }, { status: 409 }),
    );
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return withNoStore(NextResponse.json({ error: 'export expired' }, { status: 410 }));
  }

  try {
    const { signedUrl } = await signExistingDownload(
      row.fileR2Key,
      SIGNED_URL_TTL_SECONDS,
      row.fileName ?? undefined,
    );
    // 302 so browser navigates straight to R2; the JSON envelope avoids
    // CORS surprises if a future SPA client wants the URL programmatically.
    return withNoStore(NextResponse.redirect(signedUrl, 302));
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), exportId },
      'export download URL signing failed',
    );
    return withNoStore(NextResponse.json({ error: 'sign failed' }, { status: 500 }));
  }
}
