// ZUS ZWUA social-insurance deregistration (Poland) — local-only stub seam.
//
// No live PUE ZUS channel is wired (the app runs local-only; a real submission
// needs a qualified signature + PUE ZUS account out of scope for this build).
// The HR user files the ZWUA by hand via the MANUAL workflow task; this seam is
// what a later real integration slots into.

import type { GovStubResult } from './gov-stub-types';
import { maskLast2 } from './gov-stub-types';

export interface ZwuaSubmitInput {
  pesel: string;
  /** ISO date the employment ended (deregistration effective date). */
  terminationDate: string;
}

export function submitZusZwua(input: ZwuaSubmitInput): GovStubResult {
  return {
    source: 'STUB',
    available: false,
    note: `ZUS ZWUA deregistration stubbed for PESEL ending ${maskLast2(input.pesel)} — no live PUE ZUS channel is wired in this deployment.`,
  };
}
