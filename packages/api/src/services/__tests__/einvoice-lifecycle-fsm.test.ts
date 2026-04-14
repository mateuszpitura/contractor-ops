// packages/api/src/services/__tests__/einvoice-lifecycle-fsm.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 04 creates `packages/api/src/services/einvoice-lifecycle-fsm.ts`
// enforcing EInvoiceLifecycle / EInvoiceValidationStatus /
// EInvoiceTransmissionStatus state transitions (CONTEXT D-12).

import { describe } from 'vitest';

describe.todo(
  'lifecycle FSM — NOT_VALIDATED → VALID transition allowed after successful KoSIT validation',
);

describe.todo(
  'lifecycle FSM — NOT_VALIDATED → INVALID transition allowed with error report',
);

describe.todo(
  'lifecycle FSM — VALID → WARNINGS transition allowed after re-validation with new warnings',
);

describe.todo(
  'lifecycle FSM — NOT_SENT → QUEUED → SENT → DELIVERED happy path',
);

describe.todo(
  'lifecycle FSM — SENT → FAILED transition allowed after Storecove error webhook',
);

describe.todo(
  'lifecycle FSM — rejects DELIVERED → QUEUED as an invalid state transition (append-only audit trail invariant)',
);
