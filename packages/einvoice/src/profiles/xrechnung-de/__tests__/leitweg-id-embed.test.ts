// packages/einvoice/src/profiles/xrechnung-de/__tests__/leitweg-id-embed.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 02 / 04 — verifies the generator embeds the resolved Leitweg-ID at
// the BT-10 BuyerReference path when an Invoice carries a public-sector DE
// buyer (see CONTEXT D-06 resolver rule).

import { describe } from 'vitest';

describe.todo(
  'Leitweg-ID embed — generator writes resolved ID at ram:BuyerReference when contractor.isPublicSectorBuyer=true',
);

describe.todo(
  'Leitweg-ID embed — contract-level override wins over contractor default (D-06 resolver rule 1)',
);

describe.todo(
  'Leitweg-ID embed — omitted when resolver returns null (soft-gate, warning propagates via lifecycle)',
);
