// HMRC RTI (Real Time Information) Full Payment Submission — United Kingdom —
// local-only stub seam.
//
// No live HMRC RTI channel is wired (the app runs local-only; a real submission
// needs a Government Gateway credential + recognised payroll software out of
// scope for this build). The HR user files the FPS by hand via the MANUAL
// workflow task; this seam is what a later real integration slots into.

import type { GovStubResult } from './gov-stub-types';
import { maskLast2 } from './gov-stub-types';

export interface HmrcRtiInput {
  /** National Insurance number (NINO). */
  niNumber: string;
  /** Payroll identifier for the employment. */
  payrollId: string;
  /** RTI event driving the submission. */
  eventType: 'STARTER' | 'LEAVER';
}

export function submitHmrcRti(input: HmrcRtiInput): GovStubResult {
  return {
    source: 'STUB',
    available: false,
    note: `HMRC RTI ${input.eventType} FPS stubbed for NINO ending ${maskLast2(input.niNumber)} — no live HMRC RTI channel is wired in this deployment.`,
  };
}
