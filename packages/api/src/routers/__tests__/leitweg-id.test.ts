// packages/api/src/routers/__tests__/leitweg-id.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 04 creates the `leitwegId` tRPC router (D-16) — list / listByContractor
// / listByContract / create / update / delete / setDefault.

import { describe } from 'vitest';

describe.todo(
  'leitwegId.create — validates input via leitwegIdSchema (structure + Modulo-11-10 check digit)',
);

describe.todo(
  'leitwegId.create — rejects duplicate (organizationId, value) with CONFLICT',
);

describe.todo(
  'leitwegId.create — stores contractorId / contractId FKs when provided; both-null allowed for org-level entry',
);

describe.todo(
  'leitwegId.setDefault — toggles isDefaultForContractor=true on target row and unsets any prior default for the same contractor',
);

describe.todo(
  'leitwegId.delete — removes the row and cascades to invoices only as a reference break (invoice keeps string value)',
);

describe.todo(
  'leitwegId.list — multi-tenant: never returns rows from a different organizationId',
);
