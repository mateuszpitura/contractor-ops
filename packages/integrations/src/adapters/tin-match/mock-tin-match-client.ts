import { isValidEin, isValidSsn } from '@contractor-ops/validators';
import type { TinMatchClient, TinMatchInput, TinMatchResult } from './tin-match-client.js';

// Deterministic IRS TIN-Matching mock — the shipped default while the live
// e-Services client stays dark behind a flag.
//
// The IRS numerical response indicators modelled here follow Pub 2108A:
//   0 — name/TIN matches IRS records
//   1 — TIN was missing or not a 9-digit number (unusable request)
//   3 — name/TIN combination does not match IRS records (mismatch)
// Indicators 1 and 3 are the two non-zero outcomes the consuming service must
// treat as a mismatch (set the backup-withholding flag + escalate, never block).
//
// Determinism: the indicator is a pure function of the input — format gating via
// the shared US validators first, then a fixed fixture map keyed on the digits.
// No network, no randomness; the same input always yields the same indicator.

const MATCHED = 0;
const INVALID_FORMAT = 1;
const NAME_TIN_MISMATCH = 3;

/** Digits-only TINs that the fixture treats as a known IRS-records mismatch. */
const KNOWN_MISMATCH_TINS = new Set<string>(['078051120', '111223333']);

function digitsOnly(tin: string): string {
  return tin.replace(/[\s-]/g, '');
}

export class MockTinMatchClient implements TinMatchClient {
  async match(input: TinMatchInput): Promise<TinMatchResult> {
    const indicator = this.indicatorFor(input);
    return { responseIndicator: indicator, matched: indicator === MATCHED };
  }

  private indicatorFor(input: TinMatchInput): number {
    const formatValid = input.tinType === 'EIN' ? isValidEin(input.tin) : isValidSsn(input.tin);
    if (!formatValid) return INVALID_FORMAT;

    if (KNOWN_MISMATCH_TINS.has(digitsOnly(input.tin))) return NAME_TIN_MISMATCH;

    return MATCHED;
  }
}
