// ---------------------------------------------------------------------------
// Post-approval e-invoice submission triggers (ZATCA + Peppol PINT-AE)
// ---------------------------------------------------------------------------
// Called after an invoice approval flow completes. Enqueues async QStash jobs
// when the org has the relevant government integration connected.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@contractor-ops/db';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { UAE_SCHEME_ID } from '@contractor-ops/einvoice';
import { createLogger } from '@contractor-ops/logger';
import { enqueueJob } from './queue';

const log = createLogger({ service: 'einvoice-submission-triggers' });

const ZATCA_SETTLED_STATUSES = new Set(['CLEARED', 'REPORTED', 'WARNING', 'SUBMITTED']);

/** Legacy Norway scheme incorrectly used for UAE TRN — normalize on outbound. */
const LEGACY_UAE_SCHEME_ID = '0192';

/**
 * Enqueue a ZATCA clearance/reporting job when the org has an active ZATCA
 * connection and the invoice is not already in a settled chain state.
 */
export async function maybeEnqueueZatcaSubmission(
  db: PrismaClient,
  opts: { organizationId: string; invoiceId: string },
): Promise<void> {
  const [connection, existingChain] = await Promise.all([
    db.integrationConnection.findFirst({
      where: {
        organizationId: opts.organizationId,
        provider: 'ZATCA',
        status: 'CONNECTED',
      },
      select: { id: true },
    }),
    db.zatcaInvoiceChain.findUnique({
      where: { invoiceId: opts.invoiceId },
      select: { zatcaStatus: true },
    }),
  ]);

  if (!connection) return;
  if (existingChain && ZATCA_SETTLED_STATUSES.has(existingChain.zatcaStatus)) return;

  try {
    await enqueueJob(
      'zatca.submit',
      { organizationId: opts.organizationId, invoiceId: opts.invoiceId },
      { dedupId: `zatca:${opts.organizationId}:${opts.invoiceId}` },
    );
  } catch (error) {
    log.error({ err: error, ...opts }, 'failed to enqueue ZATCA submission');
  }
}

/**
 * Enqueue a Peppol PINT-AE outbound transmission for UAE orgs with an active
 * participant and a contractor Peppol identifier on the invoice.
 */
export async function maybeEnqueuePeppolOutbound(
  db: PrismaClient,
  opts: { organizationId: string; invoiceId: string },
): Promise<boolean> {
  const org = await db.organization.findUnique({
    where: { id: opts.organizationId },
    select: { countryCode: true },
  });
  if (org?.countryCode !== 'AE') return false;

  const [connection, participant, invoice] = await Promise.all([
    db.integrationConnection.findFirst({
      where: {
        organizationId: opts.organizationId,
        provider: 'PEPPOL',
        status: 'CONNECTED',
      },
      select: { id: true },
    }),
    db.peppolParticipant.findFirst({
      where: { organizationId: opts.organizationId, status: 'ACTIVE' },
      select: { id: true },
    }),
    db.invoice.findFirst({
      where: { id: opts.invoiceId, organizationId: opts.organizationId },
      include: {
        contractor: {
          select: { peppolSchemeId: true, peppolParticipantValue: true },
        },
      },
    }),
  ]);

  if (!(connection && participant && invoice)) return false;

  const schemeId = invoice.contractor?.peppolSchemeId;
  const value = invoice.contractor?.peppolParticipantValue;
  if (!(schemeId && value)) return false;

  const effectiveScheme =
    schemeId === LEGACY_UAE_SCHEME_ID || schemeId === UAE_SCHEME_ID ? UAE_SCHEME_ID : schemeId;
  const receiverParticipantId = `${effectiveScheme}:${value}`;

  const inFlight = await db.peppolTransmission.findFirst({
    where: {
      organizationId: opts.organizationId,
      invoiceId: opts.invoiceId,
      direction: 'OUTBOUND',
      status: { in: ['PENDING', 'TRANSMITTED', 'DELIVERED'] },
    },
    select: { id: true },
  });
  if (inFlight) return false;

  try {
    await enqueueJob(
      'peppol.outbound',
      {
        organizationId: opts.organizationId,
        invoiceId: opts.invoiceId,
        receiverParticipantId,
      },
      { dedupId: `peppol:outbound:${opts.organizationId}:${opts.invoiceId}` },
    );
    return true;
  } catch (error) {
    log.error({ err: error, ...opts }, 'failed to enqueue Peppol outbound');
    return false;
  }
}

/**
 * Fire-and-forget e-invoice submission jobs after invoice approval commits.
 * Must run outside the approval transaction so QStash workers see committed rows.
 */
export function enqueuePostApprovalEinvoiceJobs(
  db: PrismaClient,
  opts: { organizationId: string; invoiceId: string },
): void {
  void maybeEnqueueZatcaSubmission(db, opts).catch(() => {
    /* fire-and-forget */
  });
  void maybeEnqueuePeppolOutbound(db, opts).catch(() => {
    /* fire-and-forget */
  });
}

const POST_APPROVAL_INVOICE_STATUSES = [
  'APPROVED',
  'READY_FOR_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
] as const;

/**
 * Backstop for post-approval enqueue failures: approved invoices on ZATCA-connected
 * orgs with no chain row get a submission job re-enqueued (picked up by zatca-reconcile).
 */
export async function reconcileMissingZatcaSubmissionEnqueues(
  opts: { limit?: number } = {},
): Promise<{ scanned: number; enqueued: number; failed: number }> {
  const total = { scanned: 0, enqueued: 0, failed: 0 };

  for (const region of SUPPORTED_REGIONS) {
    try {
      const client = getRegionalClient(region);
      const result = await reconcileMissingZatcaSubmissionEnqueuesForClient(client, opts);
      total.scanned += result.scanned;
      total.enqueued += result.enqueued;
      total.failed += result.failed;
    } catch (error) {
      log.warn({ err: error, region }, 'ZATCA missing-enqueue reconcile: region skipped');
    }
  }

  return total;
}

async function reconcileMissingZatcaSubmissionEnqueuesForClient(
  db: PrismaClient,
  opts: { limit?: number },
): Promise<{ scanned: number; enqueued: number; failed: number }> {
  const connectedOrgs = await db.integrationConnection.findMany({
    where: { provider: 'ZATCA', status: 'CONNECTED' },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(connectedOrgs.map(o => o.organizationId))];
  if (orgIds.length === 0) {
    return { scanned: 0, enqueued: 0, failed: 0 };
  }

  const candidates = await db.invoice.findMany({
    where: {
      organizationId: { in: orgIds },
      status: { in: [...POST_APPROVAL_INVOICE_STATUSES] },
      deletedAt: null,
      zatcaChainEntry: null,
    },
    select: { id: true, organizationId: true },
    orderBy: { updatedAt: 'asc' },
    take: opts.limit ?? 50,
  });

  let enqueued = 0;
  let failed = 0;

  for (const invoice of candidates) {
    try {
      await enqueueJob(
        'zatca.submit',
        { organizationId: invoice.organizationId, invoiceId: invoice.id },
        { dedupId: `zatca:${invoice.organizationId}:${invoice.id}` },
      );
      enqueued += 1;
    } catch (error) {
      failed += 1;
      log.error(
        { err: error, organizationId: invoice.organizationId, invoiceId: invoice.id },
        'ZATCA reconcile: failed to enqueue missing submission',
      );
    }
  }

  return { scanned: candidates.length, enqueued, failed };
}

/**
 * Backstop for lost Peppol outbound enqueues: post-approval invoices on
 * Peppol-connected orgs whose contractor has Peppol identifiers but no
 * in-flight/delivered OUTBOUND transmission get the enqueue retried.
 * Delegates to `maybeEnqueuePeppolOutbound`, which re-checks org country,
 * participant, in-flight state and dedups the QStash job.
 */
export async function reconcileMissingPeppolOutboundEnqueues(
  opts: { limit?: number } = {},
): Promise<{ scanned: number; enqueued: number; failed: number }> {
  const total = { scanned: 0, enqueued: 0, failed: 0 };

  for (const region of SUPPORTED_REGIONS) {
    try {
      const client = getRegionalClient(region);
      const result = await reconcileMissingPeppolOutboundEnqueuesForClient(client, opts);
      total.scanned += result.scanned;
      total.enqueued += result.enqueued;
      total.failed += result.failed;
    } catch (error) {
      log.warn({ err: error, region }, 'Peppol missing-enqueue reconcile: region skipped');
    }
  }

  return total;
}

async function reconcileMissingPeppolOutboundEnqueuesForClient(
  db: PrismaClient,
  opts: { limit?: number },
): Promise<{ scanned: number; enqueued: number; failed: number }> {
  const connectedOrgs = await db.integrationConnection.findMany({
    where: { provider: 'PEPPOL', status: 'CONNECTED' },
    select: { organizationId: true },
  });
  const connectedOrgIds = [...new Set(connectedOrgs.map(o => o.organizationId))];
  if (connectedOrgIds.length === 0) {
    return { scanned: 0, enqueued: 0, failed: 0 };
  }

  // Only orgs with an ACTIVE Peppol participant can ever transmit. Excluding the
  // rest keeps invoices `maybeEnqueuePeppolOutbound` would permanently decline
  // for an inactive participant (its main permanent-decline reason) out of the
  // candidate set, so they can't sit at the head of the updatedAt-asc scan and
  // starve newer lost enqueues. Residual: the participant precondition is
  // org-level, so an invoice can still be declined for a per-org reason not
  // visible here (participant toggled inactive between this query and the
  // enqueue, or a non-AE org); such rows stay uncovered but are rare and drain
  // once the transient condition clears.
  const activeParticipants = await db.peppolParticipant.findMany({
    where: { organizationId: { in: connectedOrgIds }, status: 'ACTIVE' },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(activeParticipants.map(p => p.organizationId))];
  if (orgIds.length === 0) {
    return { scanned: 0, enqueued: 0, failed: 0 };
  }

  const limit = opts.limit ?? 50;

  // Anti-join instead of `id: { notIn: [...covered ids] }`: DELIVERED OUTBOUND
  // rows accumulate forever, so the old notIn list grew unbounded and would
  // eventually blow the PostgreSQL bind-parameter ceiling. A `NOT EXISTS`
  // correlated subquery keeps the parameter count bounded while preserving the
  // "oldest uncovered first" candidate semantics. Covered = any in-flight or
  // delivered OUTBOUND row; FAILED/REJECTED stay uncovered so a failed
  // transmission is retried (mirrors maybeEnqueuePeppolOutbound). Enum columns
  // are cast to text so the query does not couple to Postgres enum type names.
  const statuses = [...POST_APPROVAL_INVOICE_STATUSES];
  const candidates = await db.$queryRaw<Array<{ id: string; organizationId: string }>>`
    SELECT i.id, i."organizationId"
    FROM "Invoice" i
    JOIN "Contractor" c ON c.id = i."contractorId"
    WHERE i."organizationId" = ANY(${orgIds})
      AND i.status::text = ANY(${statuses})
      AND i."deletedAt" IS NULL
      AND c."peppolSchemeId" IS NOT NULL
      AND c."peppolParticipantValue" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "PeppolTransmission" pt
        WHERE pt."invoiceId" = i.id
          AND pt.direction::text = 'OUTBOUND'
          AND pt.status::text IN ('PENDING', 'TRANSMITTED', 'DELIVERED')
      )
    ORDER BY i."updatedAt" ASC
    LIMIT ${limit}
  `;

  let enqueued = 0;
  let failed = 0;

  for (const invoice of candidates) {
    try {
      const didEnqueue = await maybeEnqueuePeppolOutbound(db, {
        organizationId: invoice.organizationId,
        invoiceId: invoice.id,
      });
      if (didEnqueue) enqueued += 1;
    } catch (error) {
      failed += 1;
      log.error(
        { err: error, organizationId: invoice.organizationId, invoiceId: invoice.id },
        'Peppol reconcile: failed to enqueue missing outbound',
      );
    }
  }

  return { scanned: candidates.length, enqueued, failed };
}
