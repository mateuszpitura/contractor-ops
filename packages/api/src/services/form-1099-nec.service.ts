import type { Prisma } from '@contractor-ops/db';

import { clear, complete, reserve } from '../lib/idempotency';
import { writeAuditLog } from './audit-writer';
import { convertAmount, FX_CONVERSION_MAX_AGE_DAYS } from './exchange-rate';
import type { DbClient } from './types';

// ---------------------------------------------------------------------------
// 1099-NEC year-end generation engine.
//
// Deferred seam: this pipeline has no production callers yet — it is wired in
// when the IRS e-file transmit path ships. It is built and unit-tested ahead of
// that phase, so it reads as complete but is currently unreachable, not dead
// code. When it is wired, the synchronous `isAboveThreshold` gate must resolve
// its figure from the `Tax1099Threshold` config table (as the batch path
// already does via `getBox1ThresholdMinor`), never the local
// `SEEDED_THRESHOLDS_MINOR` constant that only backs the sync gate today.
//
// Box-1 nonemployee compensation is aggregated by payment (settlement) date
// within the calendar tax year, FX-converted to USD at the payment-date rate,
// per recipient per payer-org. Generation is gated by a tax-year-keyed
// threshold table (read from Tax1099Threshold — never a constant): $600 TY2025,
// $2,000 TY2026 under OBBBA. Box 4 records federal backup withholding when the
// recipient's W-9 backup-withholding flag is set or a TIN mismatch exists; the
// 24% payout reduction itself is enforced in a later phase.
//
// A CORRECTED 1099 supersedes rather than mutates: the prior ACTIVE row flips to
// SUPERSEDED and a new ACTIVE row is inserted inside one transaction. A filed
// row is never updated in place.
//
// PII boundary: the immutable snapshot keeps the recipient TIN as last-4 only —
// a full SSN/TIN never enters the snapshot, a log, or the Copy-B PDF rendered
// from it. The snapshot sanitizer strips any forged full-identifier key.
// ---------------------------------------------------------------------------

const USD = 'USD';

/** Idempotency TTL for a generated batch — long enough to dedupe a retry storm. */
const BATCH_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * The threshold figures and computed box amounts on a 1099 are deterministic
 * published-threshold arithmetic, not legal advice — they ship adviser-verify
 * annotated for jurisdiction sign-off before production filing.
 */
const ADVISER_VERIFY_NOTE =
  'Computed figures require jurisdiction-specific tax-adviser verification before production filing.';

// ---------------------------------------------------------------------------
// Box-1 aggregation
// ---------------------------------------------------------------------------

/** A settled payout fed into box-1 aggregation. Amounts are minor units. */
export interface SettledPayment {
  recipientId: string;
  payerOrgId: string;
  /** Payment (settlement) date — ISO string or Date; the tax year is derived from it. */
  paymentDate: string | Date;
  amountMinor: number;
  currency: string;
  /**
   * Optional pre-converted USD minor amount. When present it is trusted (the
   * caller already ran the payment-date FX conversion); when absent same-USD
   * payouts pass through unchanged and non-USD payouts must be pre-converted by
   * `aggregateBox1Async` before reaching this synchronous reducer.
   */
  usdAmountMinor?: number;
}

export interface AggregateBox1Input {
  taxYear: number;
  recipientId: string;
  payerOrgId: string;
  payments: readonly SettledPayment[];
}

export interface AggregateBox1Result {
  box1AmountMinor: number;
}

function paymentTaxYear(paymentDate: string | Date): number {
  const date = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
  return date.getUTCFullYear();
}

/**
 * Sum box-1 nonemployee comp (USD minor units) for one recipient + one
 * payer-org within the calendar tax year. Each payout is counted in the tax
 * year of its settlement date, so a different payer-org or a different year is
 * excluded from the aggregate.
 *
 * Non-USD payouts MUST already carry `usdAmountMinor` (set by
 * `aggregateBox1Async`, which runs the payment-date FX conversion). A non-USD
 * payout without a pre-converted USD amount is rejected — silently dropping it
 * would understate the box and a float coercion would drift the money value.
 */
export function aggregateBox1(input: AggregateBox1Input): AggregateBox1Result {
  const { taxYear, recipientId, payerOrgId, payments } = input;

  let box1AmountMinor = 0;
  for (const payment of payments) {
    if (payment.recipientId !== recipientId || payment.payerOrgId !== payerOrgId) {
      continue;
    }
    if (paymentTaxYear(payment.paymentDate) !== taxYear) {
      continue;
    }

    const usdMinor =
      payment.currency === USD ? payment.amountMinor : (payment.usdAmountMinor ?? null);

    if (usdMinor === null || !Number.isFinite(usdMinor)) {
      throw new Error(
        `aggregateBox1: non-USD payout for recipient ${recipientId} is missing a payment-date USD conversion`,
      );
    }
    box1AmountMinor += usdMinor;
  }

  return { box1AmountMinor };
}

/**
 * FX-convert every non-USD payout at its payment-date rate, then run the
 * synchronous box-1 reducer. The conversion reuses the in-tree exchange-rate
 * service (one HALF-UP round on the integer minor-unit product — no float
 * drift); USD payouts pass through untouched.
 */
export async function aggregateBox1Async(
  db: DbClient,
  input: AggregateBox1Input,
): Promise<AggregateBox1Result> {
  const converted: SettledPayment[] = [];
  for (const payment of input.payments) {
    if (payment.currency === USD) {
      converted.push(payment);
      continue;
    }
    const conversion = await convertAmount(
      db,
      payment.amountMinor,
      payment.currency,
      USD,
      payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate),
      // Box-1 totals feed a filed information return — a stale FX rate throws
      // (StaleExchangeRateError) rather than silently understating/overstating.
      FX_CONVERSION_MAX_AGE_DAYS,
    );
    if (!conversion) {
      throw new Error(
        `aggregateBox1Async: no payment-date FX rate for ${payment.currency}->USD on ${String(payment.paymentDate)}`,
      );
    }
    converted.push({ ...payment, usdAmountMinor: conversion.amountMinor });
  }

  return aggregateBox1({ ...input, payments: converted });
}

// ---------------------------------------------------------------------------
// Tax-year threshold gate
// ---------------------------------------------------------------------------

export interface ThresholdInput {
  taxYear: number;
  box1AmountMinor: number;
}

/**
 * Resolve the box-1 reporting threshold (USD minor units) for a tax year from
 * the Tax1099Threshold config table. NEVER a constant — OBBBA raised the
 * threshold from $600 (TY2025) to $2,000 (TY2026) for payments after
 * 2025-12-31, inflation-indexed thereafter, so the cut-off is year-keyed data.
 */
export async function getBox1ThresholdMinor(db: DbClient, taxYear: number): Promise<number> {
  const row = await db.tax1099Threshold.findUnique({ where: { taxYear } });
  if (!row) {
    throw new Error(
      `getBox1ThresholdMinor: no Tax1099Threshold configured for tax year ${taxYear}`,
    );
  }
  return row.box1ThresholdMinor;
}

/**
 * Synchronous threshold gate used where the caller already holds the year's
 * threshold figure. A recipient at or above the threshold yields a 1099; below
 * it is suppressed. The RED scaffold pins the OBBBA cut-offs ($600 TY2025 /
 * $2,000 TY2026); those figures live in the seeded config table, mirrored here
 * so the pure gate is testable without a database round-trip.
 */
export function isAboveThreshold(
  input: ThresholdInput,
  thresholdMinorByYear: Readonly<Record<number, number>> = SEEDED_THRESHOLDS_MINOR,
): boolean {
  const thresholdMinor = thresholdMinorByYear[input.taxYear];
  if (thresholdMinor === undefined) {
    throw new Error(`isAboveThreshold: no threshold configured for tax year ${input.taxYear}`);
  }
  return input.box1AmountMinor >= thresholdMinor;
}

/**
 * The seeded tax-year-keyed threshold figures (USD minor units), mirroring the
 * Tax1099Threshold config rows. Used only by the synchronous `isAboveThreshold`
 * gate; the batch path reads the live config table via `getBox1ThresholdMinor`.
 */
const SEEDED_THRESHOLDS_MINOR: Readonly<Record<number, number>> = {
  2025: 60_000,
  2026: 200_000,
};

// ---------------------------------------------------------------------------
// Box 4 (federal backup withholding)
// ---------------------------------------------------------------------------

export interface Box4Input {
  /** The recipient's W-9 backup-withholding flag (set at intake or by a TIN C-notice). */
  backupWithholdingFlagged: boolean;
  /** A TIN mismatch raised by year-end TIN-match revalidation also triggers backup withholding. */
  tinMismatch: boolean;
  /** Backup withholding already recorded for the recipient (USD minor units). */
  recordedBackupWithholdingMinor: number;
}

/**
 * Box 4 reports federal backup withholding when the recipient's W-9
 * backup-withholding flag is set or a TIN mismatch exists. This records the
 * amount already withheld; computing/applying the 24% payout reduction is a
 * later-phase concern.
 */
export function computeBox4Minor(input: Box4Input): number {
  if (!(input.backupWithholdingFlagged || input.tinMismatch)) {
    return 0;
  }
  return Math.max(0, Math.trunc(input.recordedBackupWithholdingMinor));
}

// ---------------------------------------------------------------------------
// Immutable snapshot (last-4 TIN only)
// ---------------------------------------------------------------------------

/** Keys never permitted in a 1099 snapshot payload — full personal identifiers. */
const FORBIDDEN_SNAPSHOT_KEYS = new Set(['ssn', 'ssnencrypted', 'fullssn', 'tin', 'fulltin']);

/**
 * Recursively drop any key that would carry a full SSN/TIN. The structured TIN
 * reference object (e.g. `{ tinLast4 }`) is retained; a bare scalar `tin`
 * cannot be vetted and is dropped. Mirrors the tax-form.service sanitizer so a
 * forged caller payload cannot leak a full identifier into the record-of-record.
 */
function sanitizeSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSnapshotValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (lower === 'tin' && val !== null && typeof val === 'object') {
        out[key] = sanitizeSnapshotValue(val);
        continue;
      }
      if (FORBIDDEN_SNAPSHOT_KEYS.has(lower)) {
        continue;
      }
      out[key] = sanitizeSnapshotValue(val);
    }
    return out;
  }
  return value;
}

export interface BuildSnapshotInput {
  taxYear: number;
  payerOrgId: string;
  recipientId: string;
  payerName: string;
  recipientName: string;
  /** Recipient TIN last-4 ONLY — a full SSN/TIN must never reach this builder. */
  recipientTinLast4: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  currency: string;
  cfsfStateCode?: string | null;
  corrected: boolean;
}

export interface Form1099NecSnapshot {
  taxYear: number;
  payerOrgId: string;
  recipientId: string;
  payerName: string;
  recipientName: string;
  recipientTinLast4: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  currency: string;
  cfsfStateCode: string | null;
  corrected: boolean;
  adviserVerifyNote: string;
}

/**
 * Build the immutable snapshot that IS the 1099 record-of-record. The Copy-B
 * PDF and any downstream filing render from this snapshot, never a live
 * recompute, so the document reflects the figures as filed. Defensively
 * sanitized so no full identifier survives even if a caller leaks one.
 */
export function buildForm1099NecSnapshot(input: BuildSnapshotInput): Form1099NecSnapshot {
  const snapshot: Form1099NecSnapshot = {
    taxYear: input.taxYear,
    payerOrgId: input.payerOrgId,
    recipientId: input.recipientId,
    payerName: input.payerName,
    recipientName: input.recipientName,
    recipientTinLast4: input.recipientTinLast4,
    box1AmountMinor: input.box1AmountMinor,
    box4BackupWithholdingMinor: input.box4BackupWithholdingMinor,
    currency: input.currency,
    cfsfStateCode: input.cfsfStateCode ?? null,
    corrected: input.corrected,
    adviserVerifyNote: ADVISER_VERIFY_NOTE,
  };
  return sanitizeSnapshotValue(snapshot) as Form1099NecSnapshot;
}

// ---------------------------------------------------------------------------
// CORRECTED = supersede chain
// ---------------------------------------------------------------------------

/**
 * Minimal transactional surface used by `supersedeCorrected` — accepts a Prisma
 * `$transaction` tx (or the tenant-extended client) without coupling to the
 * full delegate type.
 */
export interface Form1099NecTxClient {
  form1099Nec: {
    updateMany: (args: {
      where: Prisma.Form1099NecWhereInput;
      data: Prisma.Form1099NecUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
    create: (args: {
      data: Prisma.Form1099NecUncheckedCreateInput;
    }) => Promise<{ id: string; status: string }>;
  };
}

export interface SupersedeCorrectedInput {
  organizationId: string;
  payerOrgId: string;
  recipientId: string;
  taxYear: number;
  snapshotJson: Prisma.InputJsonValue;
  box1AmountMinor?: number;
  box4BackupWithholdingMinor?: number;
  currency?: string;
  cfsfStateCode?: string | null;
}

/**
 * Append-only CORRECTED filing within the caller's transaction.
 *
 * (1) Flips every prior ACTIVE row for this (org, payer-org, recipient, tax
 * year) to SUPERSEDED, then (2) inserts the new row as ACTIVE with
 * `corrected: true`. The supersede MUST run before the insert so a recipient
 * never holds two concurrent ACTIVE 1099s for one year. A filed row is never
 * mutated in place — a correction always inserts a new row.
 */
export async function supersedeCorrected(
  tx: Form1099NecTxClient,
  input: SupersedeCorrectedInput,
): Promise<{ id: string; status: string }> {
  const {
    organizationId,
    payerOrgId,
    recipientId,
    taxYear,
    snapshotJson,
    box1AmountMinor = 0,
    box4BackupWithholdingMinor = 0,
    currency = USD,
    cfsfStateCode = null,
  } = input;

  await tx.form1099Nec.updateMany({
    where: { organizationId, payerOrgId, recipientId, taxYear, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });

  return tx.form1099Nec.create({
    data: {
      organizationId,
      payerOrgId,
      recipientId,
      taxYear,
      status: 'ACTIVE',
      corrected: true,
      box1AmountMinor,
      box4BackupWithholdingMinor,
      currency,
      cfsfStateCode,
      snapshotJson: snapshotJson as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * Deterministic idempotency key for a batch generation so a retried batch
 * (same org + payer-org + tax year) reuses the prior reservation/result and
 * never double-files.
 */
export function batchIdempotencyKey(input: {
  organizationId: string;
  payerOrgId: string;
  taxYear: number;
}): string {
  return `form1099nec:batch:${input.organizationId}:${input.payerOrgId}:${input.taxYear}`;
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

/** One recipient's settled-payment + status context for a batch run. */
export interface BatchRecipient {
  recipientId: string;
  payerName: string;
  recipientName: string;
  recipientTinLast4: string;
  payments: readonly SettledPayment[];
  backupWithholdingFlagged: boolean;
  tinMismatch: boolean;
  recordedBackupWithholdingMinor: number;
  cfsfStateCode?: string | null;
}

export interface GenerateBatchInput {
  organizationId: string;
  payerOrgId: string;
  taxYear: number;
  recipients: readonly BatchRecipient[];
}

export interface GeneratedForm1099 {
  recipientId: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  snapshotJson: Form1099NecSnapshot;
}

export interface GenerateBatchResult {
  /** True when the result was served from a prior idempotent reservation. */
  idempotent: boolean;
  generated: GeneratedForm1099[];
  /** Recipients below the tax-year threshold — recorded for the review surface. */
  suppressedRecipientIds: string[];
}

/**
 * Minimal Prisma create surface for a single ACTIVE 1099 row — the shape of the
 * `$transaction` tx client the batch inserts through. Kept structural so a real
 * Prisma tx or a test double satisfy it.
 */
export interface Form1099NecCreateClient {
  form1099Nec: {
    create: (args: { data: Prisma.Form1099NecUncheckedCreateInput }) => Promise<{ id: string }>;
  };
}

/**
 * Transaction-capable persistence sink injected into `generateBatch`. The whole
 * batch is inserted inside one interactive transaction so a mid-batch throw rolls
 * back every row — a partial year-end filing is never left behind. The real
 * writer is the tenant Prisma client; unit tests pass a rollback-simulating double.
 */
export interface Form1099NecPersistClient {
  $transaction: <T>(fn: (tx: Form1099NecCreateClient) => Promise<T>) => Promise<T>;
}

export interface GenerateBatchDeps {
  /** Tenant client for FX conversion + threshold lookup. */
  db: DbClient;
  /**
   * Persistence sink for the generated ACTIVE rows. Injected so the deterministic
   * core is unit-testable with no live database (the real writer is supplied by
   * the schema-applied router/wiring caller). When omitted, rows are computed
   * but not persisted.
   */
  persist?: Form1099NecPersistClient;
  /** Audit identity for the generate action. */
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM';
}

/**
 * True when `err` is the P2002 unique-constraint violation raised by the
 * `Form1099Nec_active_key` partial index (at most one ACTIVE return per org /
 * payer-org / recipient / tax year). Detected structurally so the service takes
 * no direct dependency on the Prisma error class. A fresh ACTIVE-row insert can
 * only collide on this index — `id` is a new cuid and the row is a fresh ACTIVE
 * insert — so a missing/opaque `meta.target` still resolves to this violation.
 */
function isActive1099NecKeyViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || (err as { code?: unknown }).code !== 'P2002') {
    return false;
  }
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  if (typeof target === 'string') {
    return target.includes('Form1099Nec_active_key') || target.includes('recipientId');
  }
  if (Array.isArray(target)) {
    return target.includes('recipientId');
  }
  return true;
}

/**
 * Generate a tax-year 1099-NEC batch for one payer-org. Aggregates box-1 by
 * payment date (FX-converted to USD), gates each recipient on the tax-year
 * threshold table, populates box-4, and builds the immutable snapshot. When a
 * persistence sink is supplied, every ACTIVE row is inserted inside ONE
 * interactive transaction, so a mid-batch throw rolls back the whole batch — a
 * partial year-end filing is never left behind. A re-run that collides with an
 * already-filed batch (P2002 on `Form1099Nec_active_key`) is treated as an
 * idempotent skip: no duplicate rows, no error.
 *
 * Wrapped in idempotency reserve/complete/clear so a retried batch returns the
 * prior result instead of re-filing. Writes an audit row on generation.
 */
export async function generateBatch(
  input: GenerateBatchInput,
  deps: GenerateBatchDeps,
): Promise<GenerateBatchResult> {
  const { organizationId, payerOrgId, taxYear, recipients } = input;
  const { db, persist, actorId = null, actorType = 'USER' } = deps;

  const key = batchIdempotencyKey({ organizationId, payerOrgId, taxYear });
  const hit = await reserve<GenerateBatchResult>(key, BATCH_IDEMPOTENCY_TTL_SECONDS);

  if (hit.kind === 'HIT') {
    return { ...hit.result, idempotent: true };
  }
  if (hit.kind === 'PENDING') {
    // Another worker is mid-flight on this exact batch — refuse to double-file.
    return { idempotent: true, generated: [], suppressedRecipientIds: [] };
  }

  try {
    const thresholdMinor = await getBox1ThresholdMinor(db, taxYear);

    const generated: GeneratedForm1099[] = [];
    const suppressedRecipientIds: string[] = [];
    const rowsToPersist: Prisma.Form1099NecUncheckedCreateInput[] = [];

    for (const recipient of recipients) {
      const { box1AmountMinor } = await aggregateBox1Async(db, {
        taxYear,
        recipientId: recipient.recipientId,
        payerOrgId,
        payments: recipient.payments,
      });

      if (box1AmountMinor < thresholdMinor) {
        suppressedRecipientIds.push(recipient.recipientId);
        continue;
      }

      const box4BackupWithholdingMinor = computeBox4Minor({
        backupWithholdingFlagged: recipient.backupWithholdingFlagged,
        tinMismatch: recipient.tinMismatch,
        recordedBackupWithholdingMinor: recipient.recordedBackupWithholdingMinor,
      });

      const snapshotJson = buildForm1099NecSnapshot({
        taxYear,
        payerOrgId,
        recipientId: recipient.recipientId,
        payerName: recipient.payerName,
        recipientName: recipient.recipientName,
        recipientTinLast4: recipient.recipientTinLast4,
        box1AmountMinor,
        box4BackupWithholdingMinor,
        currency: USD,
        cfsfStateCode: recipient.cfsfStateCode ?? null,
        corrected: false,
      });

      if (persist) {
        rowsToPersist.push({
          organizationId,
          payerOrgId,
          recipientId: recipient.recipientId,
          taxYear,
          status: 'ACTIVE',
          corrected: false,
          box1AmountMinor,
          box4BackupWithholdingMinor,
          currency: USD,
          cfsfStateCode: recipient.cfsfStateCode ?? null,
          snapshotJson: snapshotJson as unknown as Prisma.InputJsonValue,
        });
      }

      generated.push({
        recipientId: recipient.recipientId,
        box1AmountMinor,
        box4BackupWithholdingMinor,
        snapshotJson,
      });
    }

    // Persist the whole batch in ONE interactive transaction: a mid-batch throw
    // rolls back every row rather than leaving a partial year-end filing. A P2002
    // on the `Form1099Nec_active_key` partial index means a prior successful batch
    // already filed these ACTIVE rows — the transaction rolled back, so treat the
    // re-run as an idempotent skip (no duplicate rows, no error) and cache it so
    // later retries short-circuit on the reservation.
    if (persist && rowsToPersist.length > 0) {
      try {
        await persist.$transaction(async tx => {
          for (const data of rowsToPersist) {
            await tx.form1099Nec.create({ data });
          }
        });
      } catch (err) {
        if (isActive1099NecKeyViolation(err)) {
          const skipResult: GenerateBatchResult = {
            idempotent: true,
            generated,
            suppressedRecipientIds,
          };
          await complete(key, skipResult, BATCH_IDEMPOTENCY_TTL_SECONDS);
          return skipResult;
        }
        throw err;
      }
    }

    await writeAuditLog({
      organizationId,
      actorType,
      actorId,
      action: 'form1099.generate',
      resourceType: 'ORGANIZATION',
      resourceId: payerOrgId,
      metadata: {
        taxYear,
        generatedCount: generated.length,
        suppressedCount: suppressedRecipientIds.length,
      },
    });

    const result: GenerateBatchResult = {
      idempotent: false,
      generated,
      suppressedRecipientIds,
    };
    await complete(key, result, BATCH_IDEMPOTENCY_TTL_SECONDS);
    return result;
  } catch (err) {
    // Release the reservation so the batch can be retried after a failure.
    await clear(key);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CORRECTED filing (transactional, audited)
// ---------------------------------------------------------------------------

export interface FileCorrectionInput {
  organizationId: string;
  payerOrgId: string;
  recipientId: string;
  taxYear: number;
  snapshotJson: Prisma.InputJsonValue;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  currency?: string;
  cfsfStateCode?: string | null;
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM';
}

/** Tx surface for `fileCorrection` — supersede + create + audit join one tx. */
export interface FileCorrectionTxClient extends Form1099NecTxClient {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.AuditLogUncheckedCreateInput[];
    }) => Promise<{ count: number }>;
  };
}

/**
 * File a CORRECTED 1099 inside the caller's transaction: supersede the prior
 * ACTIVE row, insert the new ACTIVE row, and write the correction audit row —
 * all atomic. The filed row is never mutated.
 */
export async function fileCorrection(
  tx: FileCorrectionTxClient,
  input: FileCorrectionInput,
): Promise<{ id: string; status: string }> {
  const created = await supersedeCorrected(tx, {
    organizationId: input.organizationId,
    payerOrgId: input.payerOrgId,
    recipientId: input.recipientId,
    taxYear: input.taxYear,
    snapshotJson: input.snapshotJson,
    box1AmountMinor: input.box1AmountMinor,
    box4BackupWithholdingMinor: input.box4BackupWithholdingMinor,
    currency: input.currency,
    cfsfStateCode: input.cfsfStateCode,
  });

  await writeAuditLog({
    tx,
    organizationId: input.organizationId,
    actorType: input.actorType ?? 'USER',
    actorId: input.actorId ?? null,
    action: 'form1099.correction',
    resourceType: 'ORGANIZATION',
    resourceId: created.id,
    metadata: {
      taxYear: input.taxYear,
      payerOrgId: input.payerOrgId,
      recipientId: input.recipientId,
    },
  });

  return created;
}
