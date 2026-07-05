// Shared shape for the government-integration stub seams (mirrors elstam-stub).
//
// Each gov interaction (I-9 + E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT
// filing) is a typed, network-free function returning this STUB result. No live
// government channel is wired this phase — the HR user completes the matching
// MANUAL workflow task by hand. A later real integration swaps the body while
// the return shape stays the same.

export interface GovStubResult {
  /** Marks this as the stub seam, never a live government response. */
  source: 'STUB';
  /** Always false — no real submission is made locally. */
  available: false;
  /** Human-readable reason surfaced to callers/logs. PII is masked to last-2. */
  note: string;
}

/** Mask an identifier to its trailing 2 characters for a stub note. */
export function maskLast2(value: string): string {
  return value.length <= 2 ? '••' : `••${value.slice(-2)}`;
}
