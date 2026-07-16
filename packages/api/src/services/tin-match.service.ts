import type { TinMatchClient, TinType } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import type { AuditWriterClient } from './audit-writer';
import { writeAuditLog } from './audit-writer';

// IRS TIN-Matching service.
//
// Production triggers: `revalidateYearEndTins` is called from the year-end
// 1099-NEC batch (staff finance router) before generation, and `matchRecipientTin`
// is called from the staff US-profile SSN-capture path — both persist the
// backup-withholding flag on a mismatch through `createDbTinMatchPersistence` +
// `createBackupWithholdingFlagWriter`. The portal W-9 self-cert path is an
// intentional gap: it never holds the full TIN (the snapshot keeps last-4 only;
// the full value lands via the staff SSN-capture path).
//
// Owns the policy around the TinMatchClient seam: a 24h result cache, a bounded
// retry on transient client failures, and the mismatch handler. The client
// itself is injected (the deterministic mock by default; the live e-Services
// client only once its PAF-enrollment flag gate clears).
//
// Mismatch posture: a non-zero IRS response indicator NEVER hard-blocks. It is
// advisory — the recipient backup-withholding flag is set and an admin
// escalation is raised (recorded per IRS B-notice / CP2100 mechanics; the 24%
// payout reduction is enforced in a later phase), and the 1099 still generates
// downstream with the TIN as captured. The function returns a result and never
// throws on a mismatch.
//
// PII boundary: a full TIN/SSN never reaches a log line, the cache key, or the
// audit metadata — only the last-4 digits.

const log = createLogger({ service: 'tin-match' });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSIENT_RETRIES = 2;

/** A non-zero indicator means the name/TIN did not match (or the request was unusable). */
const MATCHED_INDICATOR = 0;

/** Minimal shape of the injected client — both the mock and the live client satisfy it. */
type TinMatchClientLike = Pick<TinMatchClient, 'match'>;

function digitsOnly(tin: string): string {
  return tin.replace(/[\s-]/g, '');
}

function last4(tin: string): string {
  return digitsOnly(tin).slice(-4);
}

/**
 * Infer the TIN type from its shape when a caller does not supply one. An EIN is
 * the 2+7 campus-prefix form; everything else is treated as an SSN. The injected
 * client/validators apply the authoritative format check.
 */
function inferTinType(tin: string): TinType {
  return /^\d{2}-?\d{7}$/.test(tin.trim()) ? 'EIN' : 'SSN';
}

interface CacheEntry {
  responseIndicator: number;
  expiresAt: number;
}

/**
 * Process-local 24h cache. Keyed on org + recipient + name + TIN-last4 only — a
 * full TIN is never part of the key. A persistent store can replace this without
 * changing the call contract.
 */
const resultCache = new Map<string, CacheEntry>();

function cacheKey(organizationId: string, recipientId: string, name: string, tin: string): string {
  return `${organizationId}:${recipientId}:${name.trim().toLowerCase()}:${last4(tin)}`;
}

/** Clears the in-memory cache. Test-support / long-running-process maintenance only. */
export function clearTinMatchCache(): void {
  resultCache.clear();
}

/**
 * Side-effect ports for the mismatch path. Callers that have an applied schema +
 * a transaction (the year-end batch, the staff router) supply these to persist
 * the backup-withholding flag, the admin escalation, and the audit row. When
 * omitted, the service still reports what it decided to do (advisory result) so
 * the deterministic core is fully exercised without a live database.
 */
export interface TinMatchPersistence {
  /** Set the recipient's backup-withholding flag. Returns true when applied. */
  setBackupWithholdingFlag(input: {
    organizationId: string;
    recipientId: string;
    tinLast4: string;
  }): Promise<void>;
  /** Create an admin escalation for the mismatch. Returns true when created. */
  createEscalation(input: {
    organizationId: string;
    recipientId: string;
    responseIndicator: number;
    tinLast4: string;
  }): Promise<void>;
  /** Write the mismatch audit row (last-4 only in metadata). */
  writeAudit(input: {
    organizationId: string;
    recipientId: string;
    responseIndicator: number;
    tinLast4: string;
  }): Promise<void>;
}

export interface MatchRecipientTinInput {
  organizationId: string;
  recipientId: string;
  name: string;
  tin: string;
  /** Defaults to the inferred type when omitted. */
  tinType?: TinType;
  /** The TIN-matching client — the deterministic mock by default in callers. */
  client: TinMatchClientLike;
  /** Optional side-effect ports; supplied by DB-backed callers (batch / router). */
  persistence?: TinMatchPersistence;
}

export interface MatchRecipientTinResult {
  matched: boolean;
  responseIndicator: number;
  /** True when the recipient backup-withholding flag was (or would be) set. */
  backupWithholdingFlagSet: boolean;
  /** True when an admin escalation was (or would be) created. */
  escalationCreated: boolean;
  /** Always false — a TIN mismatch is advisory and never blocks generation. */
  hardBlocked: false;
  /** True when the result came from the 24h cache rather than a fresh client call. */
  fromCache: boolean;
}

/**
 * Calls the injected client with a bounded retry on transient (rejected)
 * attempts. The final attempt's rejection propagates so the caller can surface a
 * non-blocking advisory failure; a resolved indicator (including a mismatch
 * indicator) is returned without retry.
 */
async function callWithRetry(
  client: TinMatchClientLike,
  input: { name: string; tin: string; tinType: TinType },
): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    try {
      const { responseIndicator } = await client.match(input);
      return responseIndicator;
    } catch (err) {
      lastError = err;
      log.warn(
        { attempt, tinLast4: last4(input.tin) },
        'TIN-match client attempt failed; retrying if attempts remain',
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error('TIN-match client failed');
}

/**
 * Match a single recipient's name/TIN against the injected client (W-9 intake or
 * a year-end re-check). Applies the 24h cache + retry, and on a mismatch sets the
 * backup-withholding flag + raises an admin escalation + writes an audit row —
 * never throwing and never blocking the 1099.
 */
export async function matchRecipientTin(
  input: MatchRecipientTinInput,
): Promise<MatchRecipientTinResult> {
  const { organizationId, recipientId, name, tin, client, persistence } = input;
  const tinType = input.tinType ?? inferTinType(tin);
  const tinLast4 = last4(tin);

  const key = cacheKey(organizationId, recipientId, name, tin);
  const cached = resultCache.get(key);
  const now = Date.now();

  let responseIndicator: number;
  let fromCache = false;
  if (cached && cached.expiresAt > now) {
    responseIndicator = cached.responseIndicator;
    fromCache = true;
  } else {
    responseIndicator = await callWithRetry(client, { name, tin, tinType });
    resultCache.set(key, { responseIndicator, expiresAt: now + CACHE_TTL_MS });
  }

  const matched = responseIndicator === MATCHED_INDICATOR;

  if (matched) {
    return {
      matched: true,
      responseIndicator,
      backupWithholdingFlagSet: false,
      escalationCreated: false,
      hardBlocked: false,
      fromCache,
    };
  }

  // Mismatch — advisory, never a hard block. Persist the flag + escalation +
  // audit when ports are supplied; otherwise report the decision (deterministic
  // core exercised without a database).
  if (persistence) {
    await persistence.setBackupWithholdingFlag({ organizationId, recipientId, tinLast4 });
    await persistence.createEscalation({
      organizationId,
      recipientId,
      responseIndicator,
      tinLast4,
    });
    await persistence.writeAudit({ organizationId, recipientId, responseIndicator, tinLast4 });
  }

  log.info(
    { organizationId, recipientId, responseIndicator, tinLast4 },
    'TIN mismatch — backup-withholding flag set + admin escalation raised (advisory, not blocking)',
  );

  return {
    matched: false,
    responseIndicator,
    backupWithholdingFlagSet: true,
    escalationCreated: true,
    hardBlocked: false,
    fromCache,
  };
}

export interface BatchRecipient {
  recipientId: string;
  name: string;
  tin: string;
  tinType?: TinType;
}

export interface RevalidateBatchInput {
  organizationId: string;
  recipients: readonly BatchRecipient[];
  client: TinMatchClientLike;
  persistence?: TinMatchPersistence;
}

/**
 * Year-end batch re-check before 1099 generation. Each recipient is matched
 * independently; a mismatch on one recipient never aborts the loop (advisory,
 * never blocking — the batch always completes for every recipient).
 */
export async function revalidateBatchTins(
  input: RevalidateBatchInput,
): Promise<MatchRecipientTinResult[]> {
  const results: MatchRecipientTinResult[] = [];
  for (const recipient of input.recipients) {
    const result = await matchRecipientTin({
      organizationId: input.organizationId,
      recipientId: recipient.recipientId,
      name: recipient.name,
      tin: recipient.tin,
      tinType: recipient.tinType,
      client: input.client,
      persistence: input.persistence,
    });
    results.push(result);
  }
  return results;
}

/**
 * The flag-set + escalation writers a DB-backed caller supplies. These stay
 * caller-provided because the dedicated backup-withholding-flag column and the
 * TIN-mismatch escalation record are written by the year-end batch / staff
 * router against the applied Phase-86 schema; the audit row, by contrast, is
 * written here through the existing `writeAuditLog` path.
 */
export interface DbBackedPersistenceWriters {
  /** Persist the recipient backup-withholding flag (idempotent set). */
  setBackupWithholdingFlag(input: {
    organizationId: string;
    recipientId: string;
    tinLast4: string;
  }): Promise<void>;
  /** Persist the admin escalation record for the mismatch. */
  createEscalation(input: {
    organizationId: string;
    recipientId: string;
    responseIndicator: number;
    tinLast4: string;
  }): Promise<void>;
}

/**
 * Build the production {@link TinMatchPersistence} that writes the mismatch
 * audit row through `writeAuditLog` — joining the caller's transaction when
 * `tx` is supplied so the audit commits atomically with the flag set and
 * escalation. The audit metadata carries the TIN last-4 only, never a full SSN.
 */
export function createDbTinMatchPersistence(
  writers: DbBackedPersistenceWriters,
  tx?: AuditWriterClient,
): TinMatchPersistence {
  return {
    setBackupWithholdingFlag: writers.setBackupWithholdingFlag,
    createEscalation: writers.createEscalation,
    writeAudit: async ({ organizationId, recipientId, responseIndicator, tinLast4 }) => {
      await writeAuditLog({
        tx,
        organizationId,
        actorType: 'SYSTEM',
        action: 'tin_match.mismatch',
        resourceType: 'CONTRACTOR',
        resourceId: recipientId,
        metadata: { responseIndicator, tinLast4 },
      });
    },
  };
}

/**
 * Minimal Prisma surface the backup-withholding-flag writer needs — the
 * tenant-scoped client or a transaction client both satisfy it.
 */
export interface BackupWithholdingFlagDb {
  contractor: {
    updateMany(args: {
      where: { id: string; organizationId: string };
      data: { backupWithholdingFlagged: boolean };
    }): Promise<{ count: number }>;
  };
}

/**
 * Build the concrete writer that persists `Contractor.backupWithholdingFlagged
 * = true` for a TIN-mismatch recipient. This closes the previously-unwired flag
 * port: the backup-withholding decision used to live only in
 * `TaxFormSubmission.snapshotJson`, so the payout path had nothing queryable to
 * read. The set is tenant-scoped (id + organizationId) and idempotent via
 * `updateMany` — re-running TIN matching writes the same value and a missing /
 * cross-tenant row is a no-op rather than a throw. The TIN never reaches the
 * write; only the boolean flag is persisted.
 *
 * Backfill is forward-only: a contractor flagged in an earlier snapshot reads
 * `false` from the column until it is re-run through TIN matching. The 24%
 * backup-withholding deduction the flag drives at payout is adviser-verify
 * before production — legal sign-off for the US payout rail is deferred.
 */
export function createBackupWithholdingFlagWriter(
  db: BackupWithholdingFlagDb,
): DbBackedPersistenceWriters['setBackupWithholdingFlag'] {
  return async ({ organizationId, recipientId }) => {
    await db.contractor.updateMany({
      where: { id: recipientId, organizationId },
      data: { backupWithholdingFlagged: true },
    });
  };
}

/**
 * Build the mismatch-escalation writer a DB-backed caller supplies to
 * {@link createDbTinMatchPersistence}. The escalation is recorded as an audit row
 * on the caller's transaction (last-4 only in metadata) — the mismatch also
 * surfaces on the staff review list through the recipient's set
 * backup-withholding flag, so there is no dedicated escalation table to write.
 * The row is written inside the caller's `tx` so it commits atomically with the
 * flag set and the mismatch audit.
 */
export function createTinMismatchEscalationWriter(
  tx: AuditWriterClient,
  actorId: string | null,
): DbBackedPersistenceWriters['createEscalation'] {
  return async ({ organizationId, recipientId, responseIndicator, tinLast4 }) => {
    await writeAuditLog({
      tx,
      organizationId,
      actorType: actorId ? 'USER' : 'SYSTEM',
      actorId,
      action: 'form1099.tin_mismatch.escalated',
      resourceType: 'CONTRACTOR',
      resourceId: recipientId,
      metadata: { responseIndicator, tinLast4, source: 'tin_match_revalidation' },
    });
  };
}

/**
 * Transaction surface the year-end revalidation needs: the backup-withholding
 * flag write (`contractor.updateMany`) and the audit writer (`auditLog`). A real
 * Prisma `$transaction` tx satisfies both.
 */
export interface YearEndTinRevalidationTx extends BackupWithholdingFlagDb, AuditWriterClient {}

/**
 * Minimal transactional Prisma surface accepted by {@link revalidateYearEndTins}.
 * Declared structurally (mirrors the 1099 batch persist client) so the tenant
 * client or a test double satisfy it.
 */
export interface YearEndTinRevalidationDb {
  $transaction: <T>(fn: (tx: YearEndTinRevalidationTx) => Promise<T>) => Promise<T>;
}

export interface YearEndTinRevalidationInput {
  organizationId: string;
  recipients: readonly BatchRecipient[];
  /** Staff actor initiating the year-end batch; null records a SYSTEM escalation actor. */
  actorId?: string | null;
}

export interface YearEndTinRevalidationDeps {
  db: YearEndTinRevalidationDb;
  /** The TIN-matching client — the deterministic mock by default; the live client only once PAF clears. */
  client: TinMatchClientLike;
}

export interface YearEndTinRevalidationResult {
  /** Recipients whose name/TIN did not match — their backup-withholding flag was set. */
  mismatchRecipientIds: Set<string>;
}

/**
 * Year-end producer trigger for the previously-unwired TIN-match seam. Runs every
 * supplied recipient's name/TIN through the injected client and, on a mismatch,
 * sets `Contractor.backupWithholdingFlagged = true` + raises an escalation + writes
 * the mismatch audit — all inside ONE transaction so the flag, escalation, and
 * audit commit atomically (or roll back together). A mismatch is advisory and
 * NEVER blocks: the caller still generates the 1099 with the TIN as captured.
 *
 * The returned mismatch id set lets the caller fold a fresh mismatch into the
 * same batch's box-4 population without re-reading the flag it just wrote.
 */
export async function revalidateYearEndTins(
  input: YearEndTinRevalidationInput,
  deps: YearEndTinRevalidationDeps,
): Promise<YearEndTinRevalidationResult> {
  const mismatchRecipientIds = new Set<string>();
  if (input.recipients.length === 0) {
    return { mismatchRecipientIds };
  }

  const results = await deps.db.$transaction(async tx => {
    const persistence = createDbTinMatchPersistence(
      {
        setBackupWithholdingFlag: createBackupWithholdingFlagWriter(tx),
        createEscalation: createTinMismatchEscalationWriter(tx, input.actorId ?? null),
      },
      tx,
    );
    return revalidateBatchTins({
      organizationId: input.organizationId,
      recipients: input.recipients,
      client: deps.client,
      persistence,
    });
  });

  input.recipients.forEach((recipient, index) => {
    const result = results[index];
    if (result && !result.matched) {
      mismatchRecipientIds.add(recipient.recipientId);
    }
  });

  return { mismatchRecipientIds };
}
