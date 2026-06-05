import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import {
  KsefApiClient,
  ksefConnectionConfigSchema,
  mapKsefToInvoiceFields,
  parseFa3Xml,
} from '@contractor-ops/einvoice';
import { decryptCredentials } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from '../lib/advisory-lock';
import { isDemoOrg } from '../lib/demo';
import { computeDuplicateCheckHashForInvoice, runAutoMatch } from './invoice-matching';
import { checkCrossSourceDuplicate, linkDuplicateInvoices } from './ksef-duplicate-detection';
import { dispatch } from './notification-service';

type AdvisoryLockDb = {
  $queryRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
  $executeRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
};

type TenantDb = ReturnType<typeof createTenantClientFrom>;

const log = createLogger({ service: 'ksef-sync-orchestrator' });

// ---------------------------------------------------------------------------
// Post-sync helpers
// ---------------------------------------------------------------------------

/**
 * Updates the IntegrationConnection status after a sync cycle completes.
 */
async function updateConnectionAfterSync(
  db: TenantDb,
  connectionId: string,
  errors: string[],
): Promise<void> {
  const hasErrors = errors.length > 0;
  await db.integrationConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      ...(hasErrors ? {} : { lastSuccessAt: new Date() }),
      status: hasErrors ? 'ERROR' : 'CONNECTED',
      ...(hasErrors
        ? { lastErrorAt: new Date(), lastErrorMessage: errors.join('; ').slice(0, 1000) }
        : {}),
    },
  });
}

/**
 * Dispatches a batch notification to admin/finance users after KSeF sync.
 */
async function dispatchKsefSyncNotification(
  db: TenantDb,
  organizationId: string,
  connectionId: string,
  invoicesCreated: number,
  duplicatesFound: number,
): Promise<void> {
  if (invoicesCreated === 0) return;

  const members = await db.member.findMany({
    where: {
      organizationId,
      role: {
        in: ['owner', 'admin', 'finance_admin'],
      },
    },
    select: { userId: true },
  });

  const recipientUserIds = members.map(m => m.userId);
  if (recipientUserIds.length === 0) return;

  try {
    await dispatch({
      organizationId,
      type: 'KSEF_SYNC_COMPLETE',
      title: 'KSeF Sync Complete',
      body: `${invoicesCreated} new invoice${invoicesCreated === 1 ? '' : 's'} fetched from KSeF`,
      entityType: 'INVOICE',
      entityId: connectionId,
      recipientUserIds,
      metadata: { invoicesCreated, duplicatesFound, link: '/invoices?source=KSEF' },
    });
  } catch (notificationError) {
    log.error({ err: notificationError, organizationId }, 'notification dispatch failed for org');
  }
}

// ---------------------------------------------------------------------------
// Per-invoice processing helper
// ---------------------------------------------------------------------------

/**
 * Downloads, parses, creates, deduplicates, and auto-matches a single KSeF invoice.
 * Returns 'skipped' if already fetched, 'duplicate' if cross-source duplicate linked,
 * or 'created' on success.
 */
async function processSingleKsefInvoice(
  db: TenantDb,
  client: KsefApiClient,
  organizationId: string,
  ksefReferenceNumber: string,
): Promise<'skipped' | 'created' | 'duplicate'> {
  // Check if already fetched
  const alreadyExists = await db.invoice.findFirst({
    where: {
      organizationId,
      externalInvoiceId: ksefReferenceNumber,
      source: 'KSEF',
      deletedAt: null,
    },
    select: { id: true },
  });
  if (alreadyExists) return 'skipped';

  // Download and parse
  const xml = await client.downloadInvoiceXml(ksefReferenceNumber);
  const parsed = parseFa3Xml(xml, ksefReferenceNumber);
  const { invoice: fields, lines } = mapKsefToInvoiceFields(parsed);

  // Compute duplicate check hash
  const hash =
    computeDuplicateCheckHashForInvoice({
      invoiceNumber: fields.invoiceNumber,
      sellerTaxId: fields.sellerTaxId,
      sellerName: fields.sellerName,
      totalMinor: fields.totalMinor,
    }) ?? null;

  // Check cross-source duplicate (per D-11)
  const dup = fields.sellerTaxId
    ? await checkCrossSourceDuplicate(db, organizationId, fields.invoiceNumber, fields.sellerTaxId)
    : { isDuplicate: false, existingInvoiceId: null, existingSource: null };

  // dueDate required by Prisma — fall back to issueDate + 14 days
  const dueDate = fields.dueDate ?? new Date(fields.issueDate.getTime() + 14 * 24 * 3600 * 1000);

  const invoice = await db.invoice.create({
    data: {
      ...fields,
      dueDate,
      organizationId,
      duplicateCheckHash: hash,
      status: 'RECEIVED',
      matchStatus: 'UNMATCHED',
      approvalStatus: 'NOT_STARTED',
      paymentStatus: 'NOT_READY',
      lines: { create: lines.map(l => ({ ...l, organizationId })) },
    },
  });

  // Link duplicates bidirectionally (per D-12)
  let isDuplicate = false;
  if (dup.isDuplicate && dup.existingInvoiceId) {
    await linkDuplicateInvoices(db, invoice.id, dup.existingInvoiceId);
    isDuplicate = true;
  }

  // Run auto-match (per D-08)
  await runAutoMatch(db, organizationId, {
    id: invoice.id,
    sellerTaxId: fields.sellerTaxId,
    totalMinor: fields.totalMinor,
    currency: fields.currency,
    duplicateCheckHash: hash,
    issueDate: fields.issueDate,
  });

  return isDuplicate ? 'duplicate' : 'created';
}

// ---------------------------------------------------------------------------
// Sync phase helpers — extracted to keep `processKsefSync` cognitively cheap.
// All run inside the tenantStore.run + advisory-lock boundary established by
// the caller. They must NOT change RLS context or lock scope.
// ---------------------------------------------------------------------------

interface SyncTotals {
  invoicesCreated: number;
  duplicatesFound: number;
  errors: string[];
}

type KsefSyncResult =
  | { kind: 'skipped' }
  | { kind: 'ran'; connectionId: string; nip: string; totals: SyncTotals };

/**
 * Records the STARTED sync log row and attempts to acquire the connection's
 * sync advisory lock under the `'sync'` namespace. If another worker already
 * holds the lock, the sync log is marked SUCCESS with `skipped` metadata.
 *
 * Returns the sync log id and whether the lock was acquired.
 */
async function openSyncLogAndAcquireLock(
  db: TenantDb,
  organizationId: string,
  connectionId: string,
  lockKey: string,
): Promise<{ syncLogId: string; lockAcquired: boolean }> {
  const syncLog = await db.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'ksef_invoice_fetch',
      status: 'STARTED',
      startedAt: new Date(),
    },
  });

  // Prevent overlapping syncs for the same connection (QStash retries + manual triggers).
  const lockAcquired = await tryAcquireAdvisoryLock(
    db as unknown as AdvisoryLockDb,
    'sync',
    lockKey,
  );

  if (!lockAcquired) {
    await db.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: { skipped: true, reason: 'already-running' },
      },
    });
  }

  return { syncLogId: syncLog.id, lockAcquired };
}

/**
 * Loads + ownership-checks the integration connection row.
 */
async function loadKsefConnection(
  db: TenantDb,
  organizationId: string,
  connectionId: string,
): Promise<Awaited<ReturnType<TenantDb['integrationConnection']['findUniqueOrThrow']>>> {
  const connection = await db.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });
  if (connection.organizationId !== organizationId) {
    throw new Error('Connection does not belong to the specified organization');
  }
  return connection;
}

/**
 * Constructs a KSeF API client and authenticates it using either certificate
 * or token-based auth. The returned client has an active KSeF session and
 * must be terminated by the caller.
 */
async function authenticateKsefClient(
  connection: { configJson: unknown; credentialsRef: string },
  nip: string,
): Promise<KsefApiClient> {
  const credentials = decryptCredentials(connection.credentialsRef, 'ksef');
  const config = ksefConnectionConfigSchema.parse(connection.configJson);

  const client = new KsefApiClient(config.environment ?? 'prod');

  if (config.authMethod === 'certificate') {
    await client.authenticateWithCertificate(
      credentials.extra?.certificateBase64 as string,
      credentials.extra?.certificatePassword as string | undefined,
      nip,
    );
  } else {
    await client.authenticate(credentials.accessToken, nip);
  }

  return client;
}

/**
 * Asserts the org NIP is configured. Centralized so the orchestrator can
 * raise the same domain error from inside the tenantStore.run / sync-log
 * boundary as the pre-refactor code did.
 */
function assertNip(nip: string | undefined): asserts nip is string {
  if (!nip) {
    throw new Error('Organization NIP not configured. Set it in Organization Settings.');
  }
}

/**
 * Returns ISO `YYYY-MM-DD` strings for the KSeF query window. Defaults to the
 * last successful sync (incremental) or the last 90 days for a first sync.
 */
function resolveDateRange(lastSuccessAt: Date | null): { dateFrom: string; dateTo: string } {
  const dateFrom = lastSuccessAt
    ? (lastSuccessAt.toISOString().split('T')[0] ?? '')
    : (new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0] ?? '');
  const dateTo = new Date().toISOString().split('T')[0] ?? '';
  return { dateFrom, dateTo };
}

/**
 * Iterates the upstream KSeF metadata list and processes each invoice.
 * Per-invoice failures are captured in `totals.errors` rather than aborting
 * the whole sync — matches pre-refactor semantics.
 */
async function ingestKsefInvoices(
  db: TenantDb,
  client: KsefApiClient,
  organizationId: string,
  metadataList: Array<{ ksefReferenceNumber: string }>,
): Promise<SyncTotals> {
  const totals: SyncTotals = { invoicesCreated: 0, duplicatesFound: 0, errors: [] };

  for (const metadata of metadataList) {
    try {
      const outcome = await processSingleKsefInvoice(
        db,
        client,
        organizationId,
        metadata.ksefReferenceNumber,
      );
      if (outcome === 'skipped') continue;
      totals.invoicesCreated++;
      if (outcome === 'duplicate') totals.duplicatesFound++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      totals.errors.push(`Failed to process invoice ${metadata.ksefReferenceNumber}: ${msg}`);
    }
  }

  return totals;
}

/**
 * Finalizes a successful sync run: updates the connection row, marks the sync
 * log SUCCESS, and dispatches the admin notification.
 */
async function finalizeSyncSuccess(
  db: TenantDb,
  organizationId: string,
  connectionId: string,
  syncLogId: string,
  totals: SyncTotals,
): Promise<void> {
  await updateConnectionAfterSync(db, connectionId, totals.errors);

  await db.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      responsePayloadJson: {
        invoicesCreated: totals.invoicesCreated,
        duplicatesFound: totals.duplicatesFound,
        errors: totals.errors,
      },
    },
  });

  await dispatchKsefSyncNotification(
    db,
    organizationId,
    connectionId,
    totals.invoicesCreated,
    totals.duplicatesFound,
  );
}

/**
 * Marks the sync log FAILED and flips the connection into ERROR state.
 */
async function recordKsefSyncFailure(
  db: TenantDb,
  connectionId: string,
  syncLogId: string,
  error: unknown,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  await db.integrationSyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage,
    },
  });

  await db.integrationConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastErrorAt: new Date(),
      lastErrorMessage: errorMessage,
      status: 'ERROR',
    },
  });
}

/**
 * Inner body of the tenantStore.run boundary. Owns the advisory-lock lifecycle,
 * the KSeF session lifecycle, and the SUCCESS/FAILED accounting. Lives as a
 * dedicated function so the top-level `processKsefSync` stays a thin shell
 * around the regional-client + tenant-context wiring.
 */
async function runKsefSyncForConnection(
  db: TenantDb,
  organizationId: string,
  connectionId: string,
  nip: string | undefined,
): Promise<KsefSyncResult> {
  const lockKey = `ksef:${connectionId}`;
  let client: KsefApiClient | null = null;
  let lockAcquired = false;

  const { syncLogId, lockAcquired: acquired } = await openSyncLogAndAcquireLock(
    db,
    organizationId,
    connectionId,
    lockKey,
  );
  lockAcquired = acquired;
  if (!lockAcquired) {
    return { kind: 'skipped' };
  }

  try {
    const connection = await loadKsefConnection(db, organizationId, connectionId);

    // D-03: org NIP must be set before any KSeF call. Validated inside the
    // sync-log + lock boundary so failures route through `recordKsefSyncFailure`.
    assertNip(nip);

    client = await authenticateKsefClient(connection, nip);

    const { dateFrom, dateTo } = resolveDateRange(connection.lastSuccessAt ?? null);
    const result = await client.queryInvoices(nip, dateFrom, dateTo);

    const totals = await ingestKsefInvoices(db, client, organizationId, result.invoiceMetadataList);

    await finalizeSyncSuccess(db, organizationId, connectionId, syncLogId, totals);

    return { kind: 'ran', connectionId, nip, totals };
  } catch (error) {
    await recordKsefSyncFailure(db, connectionId, syncLogId, error);
    throw error;
  } finally {
    // Always terminate KSeF session
    if (client) {
      try {
        await client.terminateSession();
        // safe-swallow: session teardown runs in finally; a termination error must not mask the original sync outcome already recorded above
      } catch {
        // Swallow session termination errors
      }
    }

    if (lockAcquired) {
      await releaseAdvisoryLock(db as unknown as AdvisoryLockDb, 'sync', lockKey).catch(
        () => undefined,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// KSeF Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Processes a full KSeF sync cycle for an organization.
 *
 * Flow:
 * 1. Create sync log (STARTED)
 * 2. Decrypt credentials and parse config
 * 3. Authenticate with KSeF
 * 4. Query invoices by date range
 * 5. For each invoice: download XML, parse, create record, check duplicates, auto-match
 * 6. Update connection status
 * 7. Dispatch batch notification
 *
 * Resolves the org’s data region from the primary DB (routing table), then runs all
 * tenant data access on the regional client (`ctx.db`-equivalent) inside `tenantStore.run`.
 *
 * Uses IntegrationSyncLog for audit trail and IntegrationConnection for status tracking.
 */
export async function processKsefSync(params: {
  organizationId: string;
  connectionId: string;
}): Promise<{
  invoicesCreated: number;
  duplicatesFound: number;
  errors: string[];
}> {
  // Demo read-only — never poll the real KSeF platform for a demo org. Reached
  // via the QStash callback route (non-tRPC), so the skip lives here.
  if (isDemoOrg(params.organizationId)) {
    log.info({ organizationId: params.organizationId }, 'demo org — skipping KSeF sync');
    return { invoicesCreated: 0, duplicatesFound: 0, errors: [] };
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: params.organizationId },
  });
  const region = org.dataRegion ?? 'EU';
  const db = createTenantClientFrom(getRegionalClient(region));
  const settingsJson = (org.settingsJson as Record<string, unknown> | null) ?? {};
  const nip = settingsJson.taxId as string | undefined;

  return tenantStore.run({ organizationId: params.organizationId, region }, async () => {
    const result = await runKsefSyncForConnection(
      db,
      params.organizationId,
      params.connectionId,
      nip,
    );
    if (result.kind === 'skipped') {
      return { invoicesCreated: 0, duplicatesFound: 0, errors: [] };
    }
    return result.totals;
  });
}
