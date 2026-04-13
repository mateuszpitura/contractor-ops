import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import {
  KsefApiClient,
  ksefConnectionConfigSchema,
  mapKsefToInvoiceFields,
  parseFa3Xml,
} from '@contractor-ops/einvoice';
import { decryptCredentials } from '@contractor-ops/integrations';
import { computeDuplicateCheckHash, runAutoMatch } from './invoice-matching.js';
import { checkCrossSourceDuplicate, linkDuplicateInvoices } from './ksef-duplicate-detection.js';
import { dispatch } from './notification-service.js';

// ---------------------------------------------------------------------------
// Post-sync helpers
// ---------------------------------------------------------------------------

/**
 * Updates the IntegrationConnection status after a sync cycle completes.
 */
async function updateConnectionAfterSync(
  db: ReturnType<typeof createTenantClientFrom>,
  connectionId: string,
  errors: string[],
): Promise<void> {
  const hasErrors = errors.length > 0;
  await db.integrationConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      ...(!hasErrors ? { lastSuccessAt: new Date() } : {}),
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
  db: ReturnType<typeof createTenantClientFrom>,
  organizationId: string,
  connectionId: string,
  invoicesCreated: number,
  duplicatesFound: number,
): Promise<void> {
  if (invoicesCreated === 0) return;

  const members = await db.member.findMany({
    where: { organizationId, role: { in: ['owner', 'admin', 'finance_manager'] } },
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
    console.error(`[ksef-sync] Notification dispatch failed for org=${organizationId}:`, notificationError);
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
  db: ReturnType<typeof createTenantClientFrom>,
  client: KsefApiClient,
  organizationId: string,
  ksefReferenceNumber: string,
): Promise<'skipped' | 'created' | 'duplicate'> {
  // Check if already fetched
  const alreadyExists = await db.invoice.findFirst({
    where: { organizationId, externalInvoiceId: ksefReferenceNumber, source: 'KSEF', deletedAt: null },
    select: { id: true },
  });
  if (alreadyExists) return 'skipped';

  // Download and parse
  const xml = await client.downloadInvoiceXml(ksefReferenceNumber);
  const parsed = parseFa3Xml(xml, ksefReferenceNumber);
  const { invoice: fields, lines } = mapKsefToInvoiceFields(parsed);

  // Compute duplicate check hash
  const hash = computeDuplicateCheckHash(fields.invoiceNumber, fields.sellerTaxId ?? '', fields.totalMinor);

  // Check cross-source duplicate (per D-11)
  const dup = await checkCrossSourceDuplicate(db, organizationId, fields.invoiceNumber, fields.sellerTaxId ?? '');

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
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: params.organizationId },
  });
  const region = org.dataRegion ?? 'EU';
  const db = createTenantClientFrom(getRegionalClient(region));
  const settingsJson = (org.settingsJson as Record<string, unknown> | null) ?? {};
  const nip = settingsJson.taxId as string | undefined;

  return tenantStore.run({ organizationId: params.organizationId, region }, async () => {
    let invoicesCreated = 0;
    let duplicatesFound = 0;
    const errors: string[] = [];
    let client: KsefApiClient | null = null;

    const syncLog = await db.integrationSyncLog.create({
      data: {
        organizationId: params.organizationId,
        integrationConnectionId: params.connectionId,
        direction: 'INBOUND',
        syncType: 'ksef_invoice_fetch',
        status: 'STARTED',
        startedAt: new Date(),
      },
    });

    try {
      // -----------------------------------------------------------------------
      // Step 1: Load connection and decrypt credentials
      // -----------------------------------------------------------------------

      const connection = await db.integrationConnection.findUniqueOrThrow({
        where: { id: params.connectionId },
      });

      if (connection.organizationId !== params.organizationId) {
        throw new Error('Connection does not belong to the specified organization');
      }

      const credentials = decryptCredentials(connection.credentialsRef, 'ksef');
      const config = ksefConnectionConfigSchema.parse(connection.configJson);

      // -----------------------------------------------------------------------
      // Step 2: Organization NIP (per D-03) — loaded from primary `org` above
      // -----------------------------------------------------------------------

      if (!nip) {
        throw new Error('Organization NIP not configured. Set it in Organization Settings.');
      }

      // -----------------------------------------------------------------------
      // Step 3: Authenticate with KSeF
      // -----------------------------------------------------------------------

      client = new KsefApiClient(config.environment ?? 'prod');

      if (config.authMethod === 'certificate') {
        await client.authenticateWithCertificate(
          credentials.extra?.certificateBase64 as string,
          credentials.extra?.certificatePassword as string | undefined,
          nip,
        );
      } else {
        await client.authenticate(credentials.accessToken, nip);
      }

      // -----------------------------------------------------------------------
      // Step 4: Determine date range (last sync or 90 days for first sync)
      // -----------------------------------------------------------------------

      const dateFrom = connection.lastSuccessAt
        ? (connection.lastSuccessAt.toISOString().split('T')[0] ?? '')
        : (new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0] ?? '');
      const dateTo = new Date().toISOString().split('T')[0] ?? '';

      // -----------------------------------------------------------------------
      // Step 5: Query invoices from KSeF
      // -----------------------------------------------------------------------

      const result = await client.queryInvoices(nip, dateFrom, dateTo);

      // -----------------------------------------------------------------------
      // Step 6: Process each invoice
      // -----------------------------------------------------------------------

      for (const metadata of result.invoiceMetadataList) {
        try {
          const outcome = await processSingleKsefInvoice(
            db, client, params.organizationId, metadata.ksefReferenceNumber,
          );
          if (outcome === 'skipped') continue;
          invoicesCreated++;
          if (outcome === 'duplicate') duplicatesFound++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to process invoice ${metadata.ksefReferenceNumber}: ${msg}`);
        }
      }

      // -----------------------------------------------------------------------
      // Step 7-9: Finalize sync — update connection, sync log, notify
      // -----------------------------------------------------------------------

      await updateConnectionAfterSync(db, params.connectionId, errors);

      await db.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          responsePayloadJson: { invoicesCreated, duplicatesFound, errors },
        },
      });

      await dispatchKsefSyncNotification(db, params.organizationId, params.connectionId, invoicesCreated, duplicatesFound);

      return { invoicesCreated, duplicatesFound, errors };
    } catch (error) {
      // Update sync log to FAILED
      await db.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });

      // Update connection to ERROR
      await db.integrationConnection.update({
        where: { id: params.connectionId },
        data: {
          lastSyncAt: new Date(),
          lastErrorAt: new Date(),
          lastErrorMessage: error instanceof Error ? error.message : String(error),
          status: 'ERROR',
        },
      });

      throw error;
    } finally {
      // Always terminate KSeF session
      if (client) {
        try {
          await client.terminateSession();
        } catch {
          // Swallow session termination errors
        }
      }
    }
  });
}
