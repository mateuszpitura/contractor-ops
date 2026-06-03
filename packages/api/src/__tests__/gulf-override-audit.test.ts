// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-05.
//
// Critical behavior C9 (GULF-10): a per-org drift override of a Nitaqat threshold
// or a UAE permitted-activity catalogue calls `writeAuditLog` with
// `metadata.custom: true` (which drives the "Custom — verify with adviser" badge),
// recording the before/after values. Mirrors the Phase 71 drift-override pattern.
//
// Audit fidelity matters: an unlogged override silently diverges org config from
// the seed thresholds with no adviser-verification trail.
//
// Analog: packages/api/src/__tests__/compliance-override-mutation.test.ts +
// writeAuditLog signature in packages/api/src/services/audit-writer.ts.

import { describe, it } from 'vitest';

describe.todo('C9 (GULF-10) drift override audit-logged + custom badge', () => {
  it.todo(
    'calls writeAuditLog with metadata.custom = true when a Nitaqat threshold is overridden [79-05]',
  );

  it.todo(
    'calls writeAuditLog with metadata.custom = true when a permitted-activity catalogue is overridden [79-05]',
  );

  it.todo(
    'records before/after values in the audit metadata and passes tx inside the transaction [79-05]',
  );
});
