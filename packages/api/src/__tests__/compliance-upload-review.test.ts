// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-04 admin review of contractor uploads; mutations live in
// packages/api/src/routers/compliance/classification.ts (Plan 73-08).

import { describe, expect, it } from 'vitest';

describe('compliance-upload-review approve', () => {
  it('flips ContractorComplianceItem to SATISFIED + sets satisfiedByDocumentId + sets expiresAt', async () => {
    const mod = await import('../routers/compliance/classification.js');
    expect(mod.classificationRouter).toBeDefined();
    throw new Error('compliance.approveUploadReplacement not yet implemented');
  });

  it('moves Document.status from PENDING_REVIEW to ACTIVE', async () => {
    throw new Error('Document.status flip not yet implemented');
  });

  it('writes AuditLog action=compliance.upload.approved with metadata.itemId, metadata.documentId', async () => {
    throw new Error('audit emission not yet implemented');
  });

  it('rejects callers without compliance:override permission with FORBIDDEN', async () => {
    throw new Error('compliance:override permission gate not yet implemented');
  });
});

describe('compliance-upload-review reject', () => {
  it('moves Document.status to ARCHIVED', async () => {
    throw new Error('Document.status=ARCHIVED on reject not yet implemented');
  });

  it('keeps ContractorComplianceItem.status MISSING/EXPIRED on reject', async () => {
    throw new Error('item-status invariant on reject not yet implemented');
  });

  it('writes AuditLog action=compliance.upload.rejected with reasonCategory + freeText', async () => {
    throw new Error('reject audit emission not yet implemented');
  });

  it('dispatches notification compliance.upload.rejected to the contractor recipient', async () => {
    throw new Error('reject notification dispatch not yet implemented');
  });

  it('validates reasonCategory against closed enum', async () => {
    throw new Error('rejection reason enum not yet implemented');
  });
});
