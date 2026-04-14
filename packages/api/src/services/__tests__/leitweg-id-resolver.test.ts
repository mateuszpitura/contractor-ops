// packages/api/src/services/__tests__/leitweg-id-resolver.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 04 creates `packages/api/src/services/leitweg-id-resolver.ts`
// implementing CONTEXT D-06 resolution rule (contract override > contractor
// default > null).

import { describe } from 'vitest';

describe.todo(
  'leitweg-id-resolver — contractId override wins over contractor default (D-06 rule 1)',
);

describe.todo(
  'leitweg-id-resolver — contractor default wins when no contract row (D-06 rule 2)',
);

describe.todo(
  'leitweg-id-resolver — no matching row returns null (D-06 rule 3, triggers soft-gate)',
);

describe.todo(
  'leitweg-id-resolver — multi-tenant scoping: never returns a LeitwegId from a different organizationId',
);
