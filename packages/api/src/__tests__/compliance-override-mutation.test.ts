// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-01 manual override flow; mutation lives in
// packages/api/src/routers/compliance/classification.ts (Plan 73-03).

import { describe, expect, it } from 'vitest';

describe('compliance-override-mutation happy-path', () => {
  it('flips ContractorComplianceItem.status to WAIVED and writes audit log', async () => {
    const mod = await import('../routers/compliance/classification.js');
    expect(mod.classificationRouter).toBeDefined();
    throw new Error('compliance.overrideItem not yet implemented');
  });

  it('sets waivedReason=admin_manual_waive AND waivedReasonCategory + waivedReasonNote per input', async () => {
    throw new Error('column-write semantics not yet implemented');
  });
});

describe('compliance-override-mutation permission', () => {
  it('rejects callers without compliance:override permission with FORBIDDEN', async () => {
    throw new Error('compliance:override permission gate not yet implemented');
  });
});

describe('compliance-override-mutation freetext-min', () => {
  it('rejects reasonNote shorter than 20 chars with BAD_REQUEST', async () => {
    throw new Error('reasonNote min-length validation not yet implemented');
  });

  it('rejects reasonCategory not in closed enum with BAD_REQUEST', async () => {
    throw new Error('reasonCategory enum validation not yet implemented');
  });
});

describe('compliance-override-mutation audit-emission', () => {
  it('emits AuditLog action=compliance.item.overridden with metadata.itemId', async () => {
    throw new Error('audit-log emission not yet implemented');
  });

  it('captures actor.role snapshot in metadata for forensics', async () => {
    throw new Error('actorRoleSnapshot capture not yet implemented');
  });
});
