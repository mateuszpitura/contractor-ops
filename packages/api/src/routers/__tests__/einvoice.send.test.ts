// packages/api/src/routers/__tests__/einvoice.send.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 06 creates the `einvoice.send` tRPC mutation (D-16) wrapping the
// Storecove adapter transmission path with D-09 format discriminator + D-11
// buyer participant capability pre-flight.

import { describe } from 'vitest';

describe.todo(
  'einvoice.send — refuses transmission when PeppolParticipant status is not ACTIVE (D-10 send gate)',
);

describe.todo(
  'einvoice.send — runs lookupParticipantCapabilities pre-flight and throws PARTICIPANT_NOT_REACHABLE on failure (D-11)',
);

describe.todo(
  'einvoice.send — caches capability result into PeppolCapabilityCache with 6-hour TTL',
);

describe.todo(
  'einvoice.send — routes CII payload via format={kind:"cii-xrechnung",customizationId,profileId} discriminator (D-09)',
);

describe.todo(
  'einvoice.send — multi-tenant: rejects invoiceId belonging to a different organizationId (no cross-tenant leak)',
);

describe.todo(
  'einvoice.send — writes TRANSMITTED EInvoiceLifecycleEvent on success with Storecove message ID',
);
