/**
 * Async export framework — orchestration helpers.
 *
 * Public surface:
 *   - {@link requestExport} — called inside a tRPC mutation; persists a
 *     PENDING `Export` row and dispatches a QStash message to
 *     `/exports/_process`. Returns `{ exportId }`.
 *   - {@link claimExport} — called by the consumer at the top of the
 *     `/exports/_process` handler; atomically transitions PENDING →
 *     PROCESSING using `updateMany` so duplicate QStash deliveries can't
 *     double-render.
 *   - {@link markExportComplete} — called by the consumer after the R2
 *     upload finishes; flips status to READY and stamps `expiresAt`.
 *   - {@link markExportFailed} — terminal failure path; truncates the
 *     error to fit the column.
 *   - {@link runExportHandler} — the top-level dispatcher used by the
 *     consumer route. Looks up the registry, validates params, runs the
 *     matching handler, then marks the row READY/FAILED.
 *
 * Handlers themselves live in this file (per export type) so the
 * registry stays declarative. Adding a new export = (1) register in
 * `registry.ts`, (2) add a `case` in {@link dispatchHandler}, (3) wire a
 * mutation that calls `requestExport`.
 */

import type { Readable } from 'node:stream';
import { prisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import type { CsvColumnKey } from '../../lib/csv';
import { streamCsvResponse } from '../../lib/csv';
import { sendExportReadyEmail } from '../email/index';
import { streamObjectUpload } from '../r2';

import { iterateComplianceGaps } from './compliance-gaps';
import type { ExportType } from './registry';
import { getExportDefinition, parseExportParams } from './registry';

const log = createLogger({ service: 'exports' });

// ---------------------------------------------------------------------------
// Producer — called from tRPC mutations
// ---------------------------------------------------------------------------

export interface RequestExportInput {
  organizationId: string;
  type: ExportType;
  params: unknown;
  /** Resolved at the call site from `ctx.session.user.id` (nullable). */
  requestedByUserId?: string | null;
}

export interface RequestExportResult {
  exportId: string;
  status: 'PENDING';
}

/**
 * Persist a new `Export` row in PENDING status and enqueue a QStash
 * message for the consumer. Returns immediately so the mutation latency
 * stays bounded.
 *
 * On QStash failure the row is still persisted — ops can re-enqueue from
 * the dashboard's "your exports" panel.
 */
export async function requestExport(input: RequestExportInput): Promise<RequestExportResult> {
  const def = getExportDefinition(input.type);
  // Validate at the producer boundary so the user sees a 400 immediately
  // rather than a delayed FAILED export with a cryptic error. Cast through
  // `Record<string, unknown>` is safe because the registry's schema parses
  // every entry into a plain object shape.
  const validatedParams = parseExportParams(input.type, input.params) as Record<string, unknown>;

  const filename = def.filename(validatedParams as never);

  const row = await prisma.export.create({
    data: {
      organizationId: input.organizationId,
      type: def.type,
      status: 'PENDING',
      requestedByUserId: input.requestedByUserId ?? null,
      params: validatedParams as Prisma.InputJsonValue,
      fileName: filename,
      mimeType: def.mimeType,
    },
    select: { id: true },
  });

  // Fire QStash message; on failure the row is durable and operators can
  // re-trigger from the UI. Errors are logged at warn (not fatal).
  try {
    const [{ getQStashClient }] = await Promise.all([
      import('@contractor-ops/integrations/services/qstash-client'),
    ]);
    const env = getServerEnv();
    await getQStashClient().publishJSON({
      url: `${env.API_URL}/exports/_process`,
      body: { exportId: row.id, organizationId: input.organizationId },
      retries: 3,
      timeout: '60s',
    });
  } catch (err) {
    log.error(
      {
        err: err instanceof Error ? err.message : String(err),
        exportId: row.id,
        type: input.type,
      },
      'Failed to enqueue export job — row is still persisted',
    );
  }

  metrics.increment('export.requested', 1, { type: input.type });
  return { exportId: row.id, status: 'PENDING' };
}

// ---------------------------------------------------------------------------
// Consumer — called from /exports/_process
// ---------------------------------------------------------------------------

export interface ClaimExportResult {
  exportId: string;
  organizationId: string;
  type: ExportType;
  params: unknown;
  fileName: string;
  mimeType: string;
  requestedByUserId: string | null;
  attempts: number;
  alreadyProcessed: boolean;
}

/**
 * Atomically claim a PENDING export for processing. Uses `updateMany`
 * so a parallel QStash delivery cannot also claim the same row — the
 * second `updateMany` matches zero rows and we surface
 * `alreadyProcessed: true` to the caller, which short-circuits without
 * re-rendering.
 */
export async function claimExport(exportId: string): Promise<ClaimExportResult | null> {
  const updated = await prisma.export.updateMany({
    where: { id: exportId, status: 'PENDING' },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  const row = await prisma.export.findUnique({
    where: { id: exportId },
    select: {
      id: true,
      organizationId: true,
      type: true,
      params: true,
      fileName: true,
      mimeType: true,
      requestedByUserId: true,
      attempts: true,
      status: true,
    },
  });

  if (!row) return null;

  // updateMany returned 0 → we lost the claim race. The row is already in
  // PROCESSING/READY/FAILED. Tell the caller to skip — duplicate QStash
  // deliveries should not re-render or re-upload.
  if (updated.count === 0) {
    return {
      exportId: row.id,
      organizationId: row.organizationId,
      type: row.type as ExportType,
      params: row.params,
      fileName: row.fileName ?? 'export',
      mimeType: row.mimeType ?? 'application/octet-stream',
      requestedByUserId: row.requestedByUserId,
      attempts: row.attempts,
      alreadyProcessed: true,
    };
  }

  return {
    exportId: row.id,
    organizationId: row.organizationId,
    type: row.type as ExportType,
    params: row.params,
    fileName: row.fileName ?? 'export',
    mimeType: row.mimeType ?? 'application/octet-stream',
    requestedByUserId: row.requestedByUserId,
    attempts: row.attempts,
    alreadyProcessed: false,
  };
}

export interface MarkCompleteInput {
  exportId: string;
  fileR2Key: string;
  rowCount?: number | null;
  maxAgeDays: number;
}

export async function markExportComplete(input: MarkCompleteInput): Promise<{ expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + input.maxAgeDays * 24 * 60 * 60 * 1000);
  await prisma.export.update({
    where: { id: input.exportId },
    data: {
      status: 'READY',
      fileR2Key: input.fileR2Key,
      expiresAt,
      rowCount: input.rowCount ?? null,
      completedAt: new Date(),
      error: null,
    },
  });
  return { expiresAt };
}

export async function markExportFailed(exportId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await prisma.export.update({
    where: { id: exportId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      error: message.slice(0, 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

/**
 * Run the handler for a claimed export. On success: uploads to R2, marks
 * READY, emails the user. On failure: marks FAILED + rethrows so QStash
 * retries (up to its retry policy).
 */
export async function runExportHandler(claim: ClaimExportResult): Promise<void> {
  const def = getExportDefinition(claim.type);
  // Defense-in-depth — re-validate the persisted params against the
  // current registry schema. Catches the case where someone manually
  // edited a row in the DB or a producer drifted.
  const params = parseExportParams(claim.type, claim.params);

  const r2Key = `orgs/${claim.organizationId}/exports/${claim.exportId}/${claim.fileName}`;

  let rowCount: number | null = null;
  try {
    const result = await dispatchHandler({ claim, def, params, r2Key });
    rowCount = result.rowCount ?? null;
  } catch (err) {
    await markExportFailed(claim.exportId, err);
    metrics.increment('export.failed', 1, { type: claim.type });
    log.error(
      { err: err instanceof Error ? err.message : String(err), exportId: claim.exportId },
      'export handler failed',
    );
    throw err;
  }

  const { expiresAt } = await markExportComplete({
    exportId: claim.exportId,
    fileR2Key: r2Key,
    rowCount,
    maxAgeDays: def.maxAgeDays,
  });

  metrics.increment('export.completed', 1, { type: claim.type });

  // Email the requester with a download link. We pass the in-app route
  // (not a presigned URL) so the link survives the entire retention
  // window — the route signs a fresh URL on click.
  if (claim.requestedByUserId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: claim.requestedByUserId },
        select: { email: true },
      });
      if (user?.email) {
        await sendExportReadyEmail({
          to: user.email,
          exportDisplayName: def.displayName,
          fileName: claim.fileName,
          downloadPath: `/exports/${claim.exportId}/download`,
          expiresAtIso: expiresAt.toISOString(),
          rowCount,
        });
      }
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), exportId: claim.exportId },
        'export-ready email failed (export still durable)',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Per-type handlers
// ---------------------------------------------------------------------------

interface DispatchInput {
  claim: ClaimExportResult;
  def: ReturnType<typeof getExportDefinition>;
  params: unknown;
  r2Key: string;
}

interface DispatchResult {
  rowCount: number | null;
}

async function dispatchHandler(input: DispatchInput): Promise<DispatchResult> {
  switch (input.claim.type) {
    case 'spend-by-contractor':
      return handleSpendByContractor(input);
    case 'spend-by-team':
      return handleSpendByTeam(input);
    case 'expiring-contracts':
      return handleExpiringContracts(input);
    case 'overdue-invoices':
      return handleOverdueInvoices(input);
    case 'compliance-gaps':
      return handleComplianceGaps(input);
    case 'classification-document-sds':
      return handleClassificationDocumentSds(input);
    case 'drv-defense-bundle':
      return handleDrvDefenseBundle(input);
    case 'classification-document-us-determination-letter':
      return handleUsDeterminationLetter(input);
    case 'gdpr-privacy-notice':
      return handleGdprPrivacyNotice(input);
    default: {
      // Exhaustiveness check — adding a new ExportType without a case
      // here is a compile error.
      const Never: never = input.claim.type;
      throw new Error(`No handler for export type: ${String(Never)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CSV handlers
// ---------------------------------------------------------------------------

const CSV_PAGE_SIZE = 500;

const SPEND_COLUMNS: CsvColumnKey[] = [
  { key: 'contractorName', header: 'Contractor' },
  { key: 'invoiceCount', header: 'Invoice Count' },
  { key: 'totalMinor', header: 'Total Minor' },
  { key: 'avgMinor', header: 'Average Minor' },
  { key: 'lastPaidAt', header: 'Last Paid' },
];

const TEAM_COLUMNS: CsvColumnKey[] = [
  { key: 'teamName', header: 'Team' },
  { key: 'contractorCount', header: 'Contractors' },
  { key: 'invoiceCount', header: 'Invoice Count' },
  { key: 'totalMinor', header: 'Total Minor' },
];

const EXPIRING_COLUMNS: CsvColumnKey[] = [
  { key: 'contractTitle', header: 'Contract' },
  { key: 'contractorName', header: 'Contractor' },
  { key: 'endDate', header: 'End Date' },
  { key: 'daysRemaining', header: 'Days Remaining' },
  { key: 'status', header: 'Status' },
];

const OVERDUE_COLUMNS: CsvColumnKey[] = [
  { key: 'invoiceNumber', header: 'Invoice Number' },
  { key: 'contractorName', header: 'Contractor' },
  { key: 'amountMinor', header: 'Amount Minor' },
  { key: 'currency', header: 'Currency' },
  { key: 'dueDate', header: 'Due Date' },
  { key: 'daysOverdue', header: 'Days Overdue' },
  { key: 'status', header: 'Status' },
];

const COMPLIANCE_COLUMNS: CsvColumnKey[] = [
  { key: 'contractorName', header: 'Contractor' },
  { key: 'missingDocuments', header: 'Missing Documents' },
  { key: 'contractStatus', header: 'Contract Status' },
  { key: 'overdueTasks', header: 'Overdue Tasks' },
  { key: 'health', header: 'Health' },
];

async function uploadCsvStream(opts: {
  rows: AsyncIterable<Record<string, unknown>>;
  columns: CsvColumnKey[];
  r2Key: string;
  fileName: string;
  mimeType: string;
}): Promise<void> {
  const stream: Readable = streamCsvResponse({ columns: opts.columns, rows: opts.rows });
  const safeFilename = opts.fileName.replace(/"/g, '');
  await streamObjectUpload({
    key: opts.r2Key,
    body: stream,
    contentType: opts.mimeType,
    contentDisposition: `attachment; filename="${safeFilename}"`,
  });
}

async function handleSpendByContractor(input: DispatchInput): Promise<DispatchResult> {
  const params = input.params as { dateFrom: string; dateTo: string; contractorId?: string };
  const { Prisma } = await import('@contractor-ops/db/generated/prisma/client');

  const dateFrom = new Date(params.dateFrom);
  const dateTo = new Date(params.dateTo);
  const contractorFilter = params.contractorId
    ? Prisma.sql`AND i."contractorId" = ${params.contractorId}`
    : Prisma.empty;

  // Aggregations are fetched in a single grouped query; CSV row count is
  // bounded by distinct contractors in the date window (typically tens to
  // low thousands), so a single $queryRaw is acceptable. For >50k contractor
  // orgs this should switch to a cursor stream.
  const items = await prisma.$queryRaw<
    Array<{
      contractorName: string;
      invoiceCount: number;
      totalMinor: number;
      avgMinor: number;
      lastPaidAt: Date | null;
    }>
  >`
    SELECT
      c."legalName" AS "contractorName",
      COUNT(i.id)::int AS "invoiceCount",
      COALESCE(SUM(i."amountToPayMinor")::bigint, 0)::bigint AS "totalMinor",
      COALESCE(AVG(i."amountToPayMinor")::bigint, 0)::bigint AS "avgMinor",
      MAX(i."paidAt") AS "lastPaidAt"
    FROM "Invoice" i
    JOIN "Contractor" c ON c.id = i."contractorId"
    WHERE i."organizationId" = ${input.claim.organizationId}
      AND i."paymentStatus" = 'PAID'
      AND i."paidAt" >= ${dateFrom}
      AND i."paidAt" <= ${dateTo}
      AND i."deletedAt" IS NULL
      ${contractorFilter}
    GROUP BY c.id, c."legalName"
    ORDER BY "totalMinor" DESC
  `;

  let rowCount = 0;
  async function* rowGen() {
    for (const r of items) {
      rowCount++;
      yield {
        contractorName: r.contractorName,
        invoiceCount: Number(r.invoiceCount),
        totalMinor: Number(r.totalMinor),
        avgMinor: Number(r.avgMinor),
        lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt).toISOString() : '',
      } as Record<string, unknown>;
    }
  }

  await uploadCsvStream({
    rows: rowGen(),
    columns: SPEND_COLUMNS,
    r2Key: input.r2Key,
    fileName: input.claim.fileName,
    mimeType: input.claim.mimeType,
  });

  return { rowCount };
}

async function handleSpendByTeam(input: DispatchInput): Promise<DispatchResult> {
  const params = input.params as { dateFrom: string; dateTo: string };
  const dateFrom = new Date(params.dateFrom);
  const dateTo = new Date(params.dateTo);

  const items = await prisma.$queryRaw<
    Array<{
      teamName: string | null;
      contractorCount: number;
      invoiceCount: number;
      totalMinor: number;
    }>
  >`
    SELECT
      t.name AS "teamName",
      COUNT(DISTINCT c.id)::int AS "contractorCount",
      COUNT(i.id)::int AS "invoiceCount",
      COALESCE(SUM(i."amountToPayMinor")::bigint, 0)::bigint AS "totalMinor"
    FROM "Invoice" i
    JOIN "Contractor" c ON c.id = i."contractorId"
    LEFT JOIN "Team" t ON t.id = c."primaryTeamId"
    WHERE i."organizationId" = ${input.claim.organizationId}
      AND i."paymentStatus" = 'PAID'
      AND i."paidAt" >= ${dateFrom}
      AND i."paidAt" <= ${dateTo}
      AND i."deletedAt" IS NULL
    GROUP BY t.id, t.name
    ORDER BY "totalMinor" DESC
  `;

  let rowCount = 0;
  async function* rowGen() {
    for (const r of items) {
      rowCount++;
      yield {
        teamName: r.teamName ?? '(Unassigned)',
        contractorCount: Number(r.contractorCount),
        invoiceCount: Number(r.invoiceCount),
        totalMinor: Number(r.totalMinor),
      } as Record<string, unknown>;
    }
  }

  await uploadCsvStream({
    rows: rowGen(),
    columns: TEAM_COLUMNS,
    r2Key: input.r2Key,
    fileName: input.claim.fileName,
    mimeType: input.claim.mimeType,
  });

  return { rowCount };
}

async function handleExpiringContracts(input: DispatchInput): Promise<DispatchResult> {
  const params = input.params as { days: '30' | '60' | '90' };
  const now = new Date();
  const daysNum = parseInt(params.days, 10);
  const futureDate = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Cursor-paginated stream — bounded memory regardless of contract volume.
  let rowCount = 0;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cursor-paginated streaming generator (page loop, break conditions, per-row mapping) is one cohesive scan
  async function* rowGen() {
    let cursor: string | undefined;
    while (true) {
      const page = await prisma.contract.findMany({
        where: {
          organizationId: input.claim.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          endDate: { gte: now, lte: futureDate },
          deletedAt: null,
        },
        include: { contractor: { select: { legalName: true } } },
        orderBy: { id: 'asc' },
        take: CSV_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (page.length === 0) break;
      for (const c of page) {
        rowCount++;
        yield {
          contractTitle: c.title,
          contractorName: c.contractor.legalName,
          endDate: c.endDate?.toISOString().slice(0, 10) ?? '',
          daysRemaining: c.endDate
            ? Math.ceil((c.endDate.getTime() - now.getTime()) / msPerDay)
            : 0,
          status: c.status,
        } as Record<string, unknown>;
      }
      cursor = page[page.length - 1]?.id;
      if (page.length < CSV_PAGE_SIZE) break;
    }
  }

  await uploadCsvStream({
    rows: rowGen(),
    columns: EXPIRING_COLUMNS,
    r2Key: input.r2Key,
    fileName: input.claim.fileName,
    mimeType: input.claim.mimeType,
  });

  return { rowCount };
}

async function handleOverdueInvoices(input: DispatchInput): Promise<DispatchResult> {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  let rowCount = 0;
  async function* rowGen() {
    let cursor: string | undefined;
    while (true) {
      const page = await prisma.invoice.findMany({
        where: {
          organizationId: input.claim.organizationId,
          dueDate: { lt: now },
          paymentStatus: { notIn: ['PAID'] },
          deletedAt: null,
        },
        include: { contractor: { select: { legalName: true } } },
        orderBy: { id: 'asc' },
        take: CSV_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (page.length === 0) break;
      for (const inv of page) {
        rowCount++;
        yield {
          invoiceNumber: inv.invoiceNumber,
          contractorName: inv.contractor?.legalName ?? 'Unknown',
          amountMinor: inv.amountToPayMinor,
          currency: inv.currency,
          dueDate: inv.dueDate.toISOString().slice(0, 10),
          daysOverdue: Math.ceil((now.getTime() - inv.dueDate.getTime()) / msPerDay),
          status: inv.paymentStatus,
        } as Record<string, unknown>;
      }
      cursor = page[page.length - 1]?.id;
      if (page.length < CSV_PAGE_SIZE) break;
    }
  }

  await uploadCsvStream({
    rows: rowGen(),
    columns: OVERDUE_COLUMNS,
    r2Key: input.r2Key,
    fileName: input.claim.fileName,
    mimeType: input.claim.mimeType,
  });

  return { rowCount };
}

async function handleComplianceGaps(input: DispatchInput): Promise<DispatchResult> {
  // Async-generator streaming source. Memory is O(CSV_PAGE_SIZE) regardless
  // of org size; csv-stringify pulls one row at a time and pipes straight into
  // the R2 multipart upload via `uploadCsvStream`. See `iterateComplianceGaps`
  // jsdoc for the memory profile.
  let rowCount = 0;
  const source = iterateComplianceGaps(prisma, {
    organizationId: input.claim.organizationId,
    pageSize: CSV_PAGE_SIZE,
  });

  async function* rowGen() {
    for await (const row of source) {
      rowCount++;
      yield {
        contractorName: row.contractorName,
        missingDocuments: row.missingDocuments,
        contractStatus: row.contractStatus,
        overdueTasks: row.overdueTasks,
        health: row.health,
      } as Record<string, unknown>;
    }
  }

  await uploadCsvStream({
    rows: rowGen(),
    columns: COMPLIANCE_COLUMNS,
    r2Key: input.r2Key,
    fileName: input.claim.fileName,
    mimeType: input.claim.mimeType,
  });

  return { rowCount };
}

// ---------------------------------------------------------------------------
// PDF handlers
// ---------------------------------------------------------------------------

async function handleClassificationDocumentSds(input: DispatchInput): Promise<DispatchResult> {
  const { renderSdsPdfBuffer } = await import('../classification-document-render');
  const params = input.params as {
    classificationAssessmentId: string;
    classificationDocumentId?: string;
  };

  const { buffer, contentDisposition } = await renderSdsPdfBuffer({
    organizationId: input.claim.organizationId,
    classificationAssessmentId: params.classificationAssessmentId,
    classificationDocumentId: params.classificationDocumentId,
    requestedByUserId: input.claim.requestedByUserId,
  });

  await streamObjectUpload({
    key: input.r2Key,
    body: buffer,
    contentType: input.claim.mimeType,
    contentDisposition,
  });

  return { rowCount: null };
}

async function handleUsDeterminationLetter(input: DispatchInput): Promise<DispatchResult> {
  const { renderDeterminationLetterPdfBuffer } = await import('../classification-document-render');
  const params = input.params as {
    classificationAssessmentId: string;
    classificationDocumentId?: string;
  };

  const { buffer, contentDisposition } = await renderDeterminationLetterPdfBuffer({
    organizationId: input.claim.organizationId,
    classificationAssessmentId: params.classificationAssessmentId,
    classificationDocumentId: params.classificationDocumentId,
    requestedByUserId: input.claim.requestedByUserId,
  });

  await streamObjectUpload({
    key: input.r2Key,
    body: buffer,
    contentType: input.claim.mimeType,
    contentDisposition,
  });

  return { rowCount: null };
}

async function handleDrvDefenseBundle(input: DispatchInput): Promise<DispatchResult> {
  const { renderDrvDefenseBundlePdfBuffer } = await import('../classification-document-render');
  const params = input.params as {
    classificationAssessmentId: string;
    classificationDocumentId?: string;
  };

  const { buffer, contentDisposition } = await renderDrvDefenseBundlePdfBuffer({
    organizationId: input.claim.organizationId,
    classificationAssessmentId: params.classificationAssessmentId,
    classificationDocumentId: params.classificationDocumentId,
    requestedByUserId: input.claim.requestedByUserId,
  });

  await streamObjectUpload({
    key: input.r2Key,
    body: buffer,
    contentType: input.claim.mimeType,
    contentDisposition,
  });

  return { rowCount: null };
}

async function handleGdprPrivacyNotice(input: DispatchInput): Promise<DispatchResult> {
  const { renderGdprPrivacyNoticePdfBuffer } = await import('../privacy-notice');
  const { buffer } = await renderGdprPrivacyNoticePdfBuffer({
    organizationId: input.claim.organizationId,
  });

  await streamObjectUpload({
    key: input.r2Key,
    body: buffer,
    contentType: input.claim.mimeType,
    contentDisposition: `attachment; filename="${input.claim.fileName.replace(/"/g, '')}"`,
  });

  return { rowCount: null };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { ExportDefinition, ExportType } from './registry';
export { EXPORT_REGISTRY, getExportDefinition, parseExportParams } from './registry';
