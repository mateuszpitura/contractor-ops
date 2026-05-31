// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-04 portal one-click upload-replacement flow; mutation lives in
// packages/api/src/routers/compliance/classification.ts (Plan 73-07).

import { describe, expect, it } from 'vitest';

describe('compliance-portal-upload submitUploadReplacement', () => {
  it('updates Document.status to PENDING_REVIEW for the contractor-uploaded doc', async () => {
    const mod = await import('../routers/compliance/classification.js');
    expect(mod.classificationRouter).toBeDefined();
    throw new Error('compliance.submitUploadReplacement not yet implemented');
  });

  it('writes AuditLog action=compliance.upload.submitted with metadata.itemId', async () => {
    throw new Error('upload-submitted audit not yet implemented');
  });

  it('keeps ContractorComplianceItem.status MISSING/EXPIRED until admin review', async () => {
    throw new Error('item-status-stable invariant not yet implemented');
  });
});

describe('compliance-portal-upload cross-contractor-isolation', () => {
  it('rejects itemId belonging to a different contractor with NOT_FOUND', async () => {
    throw new Error('cross-contractor scoping not yet implemented');
  });

  it('rejects request when portal session contractorId is absent (unauthenticated)', async () => {
    throw new Error('portalProcedure session check not yet implemented');
  });
});

describe('compliance-portal-upload deep-link-payload', () => {
  it('accepts itemId + documentId + optional suggestedExpiresAt and returns updated item', async () => {
    throw new Error('mutation input shape not yet implemented');
  });
});
