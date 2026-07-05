// PIT-2 / PIT-11 filing (Poland) — local-only stub seam.
//
// No live e-Deklaracje channel is wired (the app runs local-only; a real filing
// needs a qualified signature + the e-Deklaracje gateway out of scope for this
// build). The HR user files the PIT form by hand via the MANUAL workflow task;
// this seam is what a later real integration slots into.

import type { GovStubResult } from './gov-stub-types';
import { maskLast2 } from './gov-stub-types';

export interface PitFilingInput {
  pesel: string;
  formType: 'PIT-2' | 'PIT-11';
}

export function submitPitFiling(input: PitFilingInput): GovStubResult {
  return {
    source: 'STUB',
    available: false,
    note: `${input.formType} filing stubbed for PESEL ending ${maskLast2(input.pesel)} — no live e-Deklaracje channel is wired in this deployment.`,
  };
}
