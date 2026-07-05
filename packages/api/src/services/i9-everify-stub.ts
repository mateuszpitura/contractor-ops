// I-9 employment-eligibility + E-Verify submission — local-only stub seam.
//
// There is NO live SSA/DHS E-Verify channel wired here (the app runs local-only;
// a real integration needs an enrolled employer account + web-service credentials
// out of scope for this build). The HR user completes the I-9 + E-Verify MANUAL
// workflow task by hand; this seam is what a later real integration slots into.

import type { GovStubResult } from './gov-stub-types';
import { maskLast2 } from './gov-stub-types';

export interface I9EVerifyInput {
  /** Trailing 4 of the employee SSN (a full SSN never enters this seam). */
  ssnLast4: string;
  /** Optional E-Verify case identifier once a real case exists. */
  caseId?: string;
}

export function submitI9EVerify(input: I9EVerifyInput): GovStubResult {
  return {
    source: 'STUB',
    available: false,
    note: `I-9 + E-Verify stubbed for SSN ending ${maskLast2(input.ssnLast4)} — no live SSA/DHS E-Verify channel is wired in this deployment.`,
  };
}
