/**
 * ACH return-code contract for the US payout rail.
 *
 * When an RDFI cannot post a credit it returns the entry with an R-code:
 * R01 (insufficient funds), R02 (account closed), R03 (no account / unable to
 * locate), and the rest of the R-family are hard failures — the money did not
 * land, so the matching PaymentRunItem must move to FAILED. The C-code
 * corrections (NOC / COR, e.g. C01) are advisory: the payout settled, but the
 * RDFI is asking the originator to correct the account details for next time;
 * they never fail a payout.
 *
 * The parser is a hand-rolled reader of the fixed-width NACHA return record
 * layout (mirroring the offsets the generator writes), so it reads a file the
 * generator could emit — no external NACHA dependency. The apply layer is
 * idempotent, tenant-scoped, and audits every transition; the reachable
 * return-file entry point that feeds it live files is wired separately.
 */

import { createLogger } from '@contractor-ops/logger';
import { revertInvoicePaymentOutcome } from '../routers/finance/payment-shared';
import { writeAuditLog } from './audit-writer';
import type { OutboxTransactionalClient } from './outbox';
import { enqueuePaymentStatusNotification, getPaymentNotifyUserIds } from './payment-notification';
import type { DbClient } from './types';

const log = createLogger({ service: 'ach-return' });

/** Whether a return code fails the payout or is a non-failing correction. */
export type AchReturnDisposition = 'FAILED' | 'ADVISORY';

/** A single return code resolved to its disposition + a human-readable reason. */
export interface AchReturnCodeMapping {
  code: string;
  disposition: AchReturnDisposition;
  reason: string;
}

/** One returned entry parsed out of a NACHA return file. */
export interface AchReturnEntry {
  traceNumber: string;
  individualId: string;
  amountMinor: number;
  returnCode: string;
  addendaInfo: string;
}

export interface ApplyAchReturnsArgs {
  organizationId: string;
  paymentRunId: string;
  actorId: string;
  entries: AchReturnEntry[];
  /** Optional ingestion-level audit written in the same transaction. */
  ingestAudit?: {
    entryCount: number;
    fileBytes: number;
  };
}

export interface ApplyAchReturnsResult {
  failed: number;
  advisory: number;
  skipped: number;
  /**
   * FAILED-disposition entries whose individualId matched no live run item.
   * Distinguishes a clean no-bounce run (0) from a wrong-run / mis-uploaded
   * file (high) — the operator-safety signal.
   */
  unmatched: number;
}

/** Specific return codes that carry a distinct operator-facing reason. */
const RETURN_REASONS: Record<string, string> = {
  R01: 'Insufficient funds in the receiving account',
  R02: 'Receiving account is closed',
  R03: 'No account / unable to locate the receiving account',
};

/**
 * Resolve a NACHA return/correction code to its disposition + reason.
 *
 * R-codes are hard returns — the credit did not post, so the payout must move to
 * FAILED. C-codes and NOC are Notifications of Change: the payout settled but the
 * RDFI is advising an account-detail correction for next time, so they are
 * ADVISORY and never fail a payout. An unrecognised, non-correction code defaults
 * to FAILED so an unposted credit is never silently treated as settled.
 */
export function mapReturnCodeToStatus(code: string): AchReturnCodeMapping {
  const normalized = code.trim().toUpperCase();

  if (normalized === 'NOC' || normalized.startsWith('C')) {
    return {
      code: normalized,
      disposition: 'ADVISORY',
      reason: 'Account detail change advised by the receiving bank; payout not failed',
    };
  }

  return {
    code: normalized,
    disposition: 'FAILED',
    reason: RETURN_REASONS[normalized] ?? 'Payout returned by the receiving bank',
  };
}

// Fixed-width column offsets of the NACHA return records the generator emits.
// Entry-detail (type 6) and its addenda-99 (type 7) return record are 94 chars.
const ENTRY_AMOUNT = [29, 39] as const;
const ENTRY_INDIVIDUAL_ID = [39, 54] as const;
const ENTRY_TRACE = [79, 94] as const;
const ADDENDA_TYPE = [1, 3] as const;
const ADDENDA_RETURN_CODE = [3, 6] as const;
const ADDENDA_INFO = [35, 79] as const;

const field = (line: string, [start, end]: readonly [number, number]): string =>
  line.slice(start, end).trim();

/**
 * Parse a NACHA return file into its returned entries. Each returned credit is an
 * entry-detail (type 6) record immediately followed by its addenda-99 (type 7)
 * return record carrying the R-code and reason. Records are read at the exact
 * fixed-width offsets the generator writes.
 *
 * This is an untrusted-file boundary: parsing is defensive (safe slice + trim,
 * length-guarded), a stray or malformed record is skipped rather than thrown on,
 * and only a well-formed entry paired with its addenda-99 is emitted.
 */
export function parseNachaReturnFile(fileText: string): AchReturnEntry[] {
  const entries: AchReturnEntry[] = [];
  let pending: Pick<AchReturnEntry, 'traceNumber' | 'individualId' | 'amountMinor'> | null = null;

  for (const line of fileText.split(/\r\n|\r|\n/)) {
    const recordType = line.charAt(0);

    if (recordType === '6') {
      pending = null;
      if (line.length < ENTRY_INDIVIDUAL_ID[1]) continue;
      const individualId = field(line, ENTRY_INDIVIDUAL_ID);
      const amountDigits = field(line, ENTRY_AMOUNT).replace(/\D/g, '');
      const amountMinor = amountDigits.length > 0 ? Number(amountDigits) : Number.NaN;
      if (individualId.length === 0 || !Number.isFinite(amountMinor)) continue;
      pending = { traceNumber: field(line, ENTRY_TRACE), individualId, amountMinor };
      continue;
    }

    if (recordType === '7') {
      if (line.length < ADDENDA_RETURN_CODE[1]) continue;
      if (line.slice(ADDENDA_TYPE[0], ADDENDA_TYPE[1]) !== '99') continue;
      if (!pending) continue;
      const returnCode = field(line, ADDENDA_RETURN_CODE).toUpperCase();
      if (returnCode.length === 0) {
        pending = null;
        continue;
      }
      entries.push({ ...pending, returnCode, addendaInfo: field(line, ADDENDA_INFO) });
      pending = null;
    }
  }

  return entries;
}

// Statuses a live payout item can transition FROM into FAILED. An already-FAILED
// item is never re-transitioned (idempotent re-delivery, and a return is never
// allowed to un-fail); a SKIPPED item was excluded from the run, so a return for
// it is anomalous and left untouched.
const TRANSITIONABLE_STATUSES = new Set(['PENDING', 'EXPORTED', 'PAID']);

// Above this proportion of unmatched FAILED entries the file most likely targets
// the wrong run or was mis-uploaded — worth an operator-facing warn.
const HIGH_UNMATCHED_RATIO = 0.5;

type LoadedRunItem = {
  id: string;
  status: string;
  failureReason: string | null;
  paymentReference: string | null;
  amountMinor: number;
  invoiceId: string | null;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    currency: string;
    paymentStatus: string;
  } | null;
};

/** Match a return entry to its live item by invoice number, then payment reference. */
function matchItem(items: LoadedRunItem[], individualId: string): LoadedRunItem | null {
  if (individualId.length === 0) return null;
  return (
    items.find(i => i.invoice?.invoiceNumber === individualId) ??
    items.find(i => i.paymentReference === individualId) ??
    null
  );
}

/**
 * Apply parsed returns to a payment run. R-code entries flip their matched live
 * PaymentRunItem to FAILED with a failureReason; C-code / NOC entries are
 * recorded advisory-only (no status change). The whole apply runs in a single
 * transaction so a partial failure never leaves a half-applied run.
 *
 * Money-movement invariants:
 *   - Tenant-scoped: items are loaded `where { paymentRunId, organizationId }`,
 *     so a foreign-org item is never matched or flipped.
 *   - Idempotent: an already-FAILED item is skipped — a re-delivered file is a
 *     no-op, and a return can never un-fail an item.
 *   - Audited: one masked audit row per applied transition (failure or advisory);
 *     metadata carries itemId / returnCode / reason / amount only, never bank data.
 *   - A FAILED-disposition entry that matches no live item is counted `unmatched`
 *     (never silently dropped) so a wrong-run / mis-uploaded file is visible.
 */
export async function applyAchReturns(
  db: DbClient,
  args: ApplyAchReturnsArgs,
): Promise<ApplyAchReturnsResult> {
  const { organizationId, paymentRunId, actorId, entries, ingestAudit } = args;

  const financeRecipients = await getPaymentNotifyUserIds(
    db as unknown as import('../lib/tenant-db').TenantScopedDb,
    organizationId,
  );

  const result = await db.$transaction(async tx => {
    const run = await tx.paymentRun.findFirst({
      where: { id: paymentRunId, organizationId },
      select: { runNumber: true },
    });

    const items = (await tx.paymentRunItem.findMany({
      where: { paymentRunId, organizationId },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, currency: true, paymentStatus: true },
        },
      },
    })) as LoadedRunItem[];

    let failed = 0;
    let advisory = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const entry of entries) {
      const mapping = mapReturnCodeToStatus(entry.returnCode);
      const match = matchItem(items, entry.individualId);

      if (mapping.disposition === 'ADVISORY') {
        await writeAuditLog({
          tx,
          organizationId,
          actorType: 'USER',
          actorId,
          action: 'payment_run.ach_correction_advised',
          resourceType: 'PAYMENT_RUN',
          resourceId: paymentRunId,
          metadata: {
            itemId: match?.id ?? null,
            individualId: entry.individualId,
            returnCode: mapping.code,
            reason: mapping.reason,
            amountMinor: entry.amountMinor,
          },
        });
        advisory += 1;
        continue;
      }

      if (!match) {
        unmatched += 1;
        continue;
      }

      if (!TRANSITIONABLE_STATUSES.has(match.status)) {
        skipped += 1;
        continue;
      }

      const failureReason = `ACH return ${mapping.code}: ${mapping.reason}`;
      await tx.paymentRunItem.update({
        where: { id: match.id },
        data: { status: 'FAILED', failureReason },
      });
      if (match.invoiceId) {
        const paymentStatus = match.invoice?.paymentStatus;
        if (paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_PAID') {
          await revertInvoicePaymentOutcome(tx, {
            organizationId,
            invoiceId: match.invoiceId,
            sourcePaymentRunItemId: match.id,
          });
        } else {
          await tx.invoice.updateMany({
            where: {
              id: match.invoiceId,
              organizationId,
              paymentStatus: { in: ['READY', 'IN_RUN'] },
            },
            data: {
              paymentStatus: 'NOT_READY',
              readyForPaymentAt: null,
            },
          });
        }
      }
      // Reflect the transition locally so a second entry in the same file that
      // targets this item is skipped rather than re-flipped.
      match.status = 'FAILED';
      match.failureReason = failureReason;

      await writeAuditLog({
        tx,
        organizationId,
        actorType: 'USER',
        actorId,
        action: 'payment_run.ach_return_applied',
        resourceType: 'PAYMENT_RUN',
        resourceId: paymentRunId,
        metadata: {
          itemId: match.id,
          returnCode: mapping.code,
          reason: mapping.reason,
          amountMinor: entry.amountMinor,
        },
      });

      await enqueuePaymentStatusNotification(tx as unknown as OutboxTransactionalClient, {
        organizationId,
        paymentRunId,
        runNumber: run?.runNumber ?? null,
        itemId: match.id,
        invoiceId: match.invoiceId ?? match.id,
        invoiceNumber: match.invoice?.invoiceNumber ?? null,
        status: 'FAILED',
        amountMinor: match.amountMinor,
        currency: match.invoice?.currency ?? 'USD',
        failureReason,
        recipientUserIds: financeRecipients,
      });

      failed += 1;
    }

    if (ingestAudit) {
      await writeAuditLog({
        tx,
        organizationId,
        actorType: 'USER',
        actorId,
        action: 'payment_run.ach_return_ingested',
        resourceType: 'PAYMENT_RUN',
        resourceId: paymentRunId,
        metadata: {
          entryCount: ingestAudit.entryCount,
          fileBytes: ingestAudit.fileBytes,
          failed,
          advisory,
          skipped,
          unmatched,
        },
      });
    }

    return { failed, advisory, skipped, unmatched };
  });

  if (entries.length > 0 && result.unmatched / entries.length >= HIGH_UNMATCHED_RATIO) {
    log.warn(
      { paymentRunId, unmatched: result.unmatched, total: entries.length },
      'ACH return file has a high unmatched proportion — verify it targets this run',
    );
  }

  return result;
}
