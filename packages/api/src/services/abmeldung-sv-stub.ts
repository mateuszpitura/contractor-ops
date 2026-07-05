// Abmeldung zur Sozialversicherung (DEÜV) — Germany social-insurance
// deregistration — local-only stub seam.
//
// No live DEÜV/payroll channel is wired (the app runs local-only; a real
// submission needs certified payroll software + a transmission channel out of
// scope for this build). The HR user files the Abmeldung by hand via the MANUAL
// workflow task; this seam is what a later real integration slots into.

import type { GovStubResult } from './gov-stub-types';
import { maskLast2 } from './gov-stub-types';

export interface AbmeldungSvInput {
  /** Sozialversicherungsnummer (SV-Nr). */
  svNumber: string;
  /** ISO date the employment ended. */
  terminationDate: string;
}

export function submitAbmeldungSv(input: AbmeldungSvInput): GovStubResult {
  return {
    source: 'STUB',
    available: false,
    note: `Abmeldung SV stubbed for SV-Nr ending ${maskLast2(input.svNumber)} — no live DEÜV channel is wired in this deployment.`,
  };
}
