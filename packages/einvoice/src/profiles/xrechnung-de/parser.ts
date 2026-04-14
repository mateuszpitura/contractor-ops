// Phase 61 · Plan 61-02 Task 2 — XRechnung CII inbound parser STUB.
//
// Inbound parsing of a foreign-originated XRechnung CII document is a Phase 62
// scope item (see .planning/phases/61-xrechnung-e-invoicing/61-CONTEXT.md
// §Phase Boundary). Phase 61 only OUTBOUND-generates XRechnung XML; there is
// no code path in Plans 61-02 through 61-08 that calls `parseXRechnungCii`.
//
// The stub exists solely to satisfy the `EInvoiceProfile.parse()` contract —
// removing it would require breaking the shared profile interface, which
// would force KSeF / ZATCA / Peppol-AE parity work that is out of scope.
//
// When Phase 62 implements inbound parsing, replace this stub with a
// fast-xml-parser XMLParser pipeline that maps CII elements back into the
// canonical `EInvoice` envelope (inverse of generator.ts). Tracked as a
// Phase 62 deliverable.

import type { EInvoice } from '../../types/invoice.js';

/**
 * STUB — always throws. Inbound CII parsing is deferred to Phase 62.
 *
 * @throws {Error} Always. Callers must feature-detect via `profileId` before
 *                 invoking parse on the xrechnung-de profile in Phase 61.
 */
export function parseXRechnungCii(_xml: string): EInvoice {
  throw new Error(
    'XRechnung CII inbound parsing is a Phase 62 feature — not implemented in Phase 61',
  );
}
