// packages/api/src/routers/__tests__/einvoice.finalize.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 04 creates the `einvoice` tRPC router (D-16) with `finalize` mutation.
// These `describe.todo` entries are the signed contract for that plan.

import { describe } from 'vitest';

describe.todo(
  'einvoice.finalize — generates XRechnung CII XML from Invoice + lines + parties and persists EInvoiceLifecycle row',
);

describe.todo(
  'einvoice.finalize — runs KoSIT 3-layer validation and persists validationReportSummary + R2 key for full HTML report',
);

describe.todo(
  'einvoice.finalize — returns LEITWEG_ID_MISSING warning when contractor.isPublicSectorBuyer=true and resolver returns null',
);

describe.todo(
  'einvoice.finalize — multi-tenant: rejects invoiceId belonging to a different organizationId with NOT_FOUND (no cross-tenant leak)',
);

describe.todo(
  'einvoice.finalize — force=true re-finalizes an existing lifecycle and writes RE_VALIDATED event',
);
