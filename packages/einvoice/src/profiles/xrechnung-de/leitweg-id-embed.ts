// Phase 61 · Plan 61-02 Task 1 — BT-10 (Leitweg-ID) embed helper.
//
// Isolated so the generator's tree building stays pure and so that higher
// layers (Plan 04 resolver) can short-circuit when no Leitweg-ID resolves.
//
// Path written: /rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/
//               ram:ApplicableHeaderTradeAgreement/ram:BuyerReference
//
// The helper is deliberately permissive about the ID string — normalisation
// (trim, case, presence) is the resolver's job. We persist whatever we get so
// downstream validation (Plan 03) surfaces bad input rather than silently
// masking it.

import type { CiiDocShape } from './generator.js';

/**
 * Returns a structural clone of `doc` with `ram:BuyerReference` set to
 * `leitwegId` under the XRechnung BT-10 path. The input is not mutated.
 */
export function embedLeitwegIdIntoCii(doc: CiiDocShape, leitwegId: string): CiiDocShape {
  const clone = structuredClone(doc);
  const agreement =
    clone['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction'][
      'ram:ApplicableHeaderTradeAgreement'
    ];
  agreement['ram:BuyerReference'] = leitwegId;
  return clone;
}
