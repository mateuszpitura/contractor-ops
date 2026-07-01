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
 * These are throwing placeholders. The NACHA return-file parser and the
 * idempotent status-transition logic land with the return-file ingestion work;
 * this file locks the types + signatures the tests and the ingestion procedure
 * import against so the contract cannot drift underneath them.
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

/**
 * Resolve a NACHA return/correction code to its disposition + reason. R-codes
 * are FAILED; NOC/COR C-codes are ADVISORY.
 */
export function mapReturnCodeToStatus(_code: string): AchReturnCodeMapping {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Parse a NACHA return file into its returned entries, reading the R-code and
 * addenda information from each entry's addenda-99 record.
 */
export function parseNachaReturnFile(_fileText: string): AchReturnEntry[] {
  throw new Error(NOT_IMPLEMENTED);
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
