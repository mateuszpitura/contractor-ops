// packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 02 creates `packages/einvoice/src/profiles/xrechnung-de/generator.ts`.
// Until then, the `describe.todo` entries below act as the signed contract
// for Plan 02's TDD loop. Each `describe.todo` row maps to a row in
// .planning/phases/61-xrechnung-e-invoicing/61-VALIDATION.md §Per-Task
// Verification Map.

import { describe } from 'vitest';

describe.todo(
  'XRechnung generator — minimal valid invoice produces CII XML that passes layer-1 XSD',
);

describe.todo(
  'XRechnung generator — Leitweg-ID embedded at /rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerReference',
);

describe.todo(
  'XRechnung generator — reverse-charge §13b UStG maps to BT-120 TaxExemptionReason text',
);

describe.todo(
  'XRechnung generator — Kleinunternehmer §19 UStG sets BT-118/BT-119 per KoSIT rule',
);

describe.todo(
  'XRechnung generator — document-level CustomizationID + ProfileID pair matches XRECHNUNG_CUSTOMIZATION_ID + XRECHNUNG_PROFILE_ID constants',
);
