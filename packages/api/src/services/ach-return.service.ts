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

import type { DbClient } from './types';

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
}

export interface ApplyAchReturnsResult {
  failed: number;
  advisory: number;
  skipped: number;
}

const NOT_IMPLEMENTED = 'ach-return.service is a contract stub — no implementation yet';

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

/**
 * Apply parsed returns to a payment run: R-code entries flip their live
 * PaymentRunItem to FAILED, C-code entries are recorded advisory-only, and an
 * already-applied entry is skipped (idempotent re-delivery).
 */
export function applyAchReturns(
  _db: DbClient,
  _args: ApplyAchReturnsArgs,
): Promise<ApplyAchReturnsResult> {
  throw new Error(NOT_IMPLEMENTED);
}
