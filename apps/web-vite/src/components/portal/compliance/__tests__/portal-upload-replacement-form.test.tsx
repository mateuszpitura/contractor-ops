// Phase 73 Wave 0 — Nyquist failing scaffold (web-vite)
// Maps to COMPL-04 portal one-click upload-replacement; form view lives in
// apps/web-vite/src/components/portal/compliance/portal-upload-replacement-form.tsx (Plan 73-07).

import { describe, expect, it } from 'vitest';

// Vite resolves a static `await import('literal')` at transform time, which would
// fail the whole suite (collection error) instead of the assertion. Indirecting the
// specifier through a variable + `@vite-ignore` keeps the failure at runtime so the
// named test case fails as a deterministic Nyquist RED until Plan 73-07 lands the views.
const FORM_PATH = '../portal-upload-replacement-form';
const BANNER_PATH = '../../portal-home-compliance-banner';

describe('portal-compliance-upload-replacement render', () => {
  it('exports a PortalUploadReplacementForm view', async () => {
    const mod = await import(/* @vite-ignore */ FORM_PATH);
    expect(mod.PortalUploadReplacementForm).toBeTypeOf('function');
    throw new Error('PortalUploadReplacementForm not yet implemented');
  });

  it('auto-derives the DropZone documentType from the deep-link policyRuleId', async () => {
    throw new Error('auto-derived documentType not yet implemented');
  });

  it('auto-fills expiresAt input from defaultExpiryFromUploadDate(policyRule, today)', async () => {
    throw new Error('auto-filled expiresAt not yet implemented');
  });

  it('contractor can override the auto-filled expiresAt via the editable date picker', async () => {
    throw new Error('expiresAt editable not yet implemented');
  });
});

describe('portal-compliance-upload-replacement submit', () => {
  it('invokes the upload-replacement hook on submit (trpc.classification.submitUploadReplacement)', async () => {
    throw new Error('mutation call not yet implemented');
  });

  it('shows success message + navigates to /portal/compliance on success', async () => {
    throw new Error('success-redirect not yet implemented');
  });
});

describe('portal-home-compliance-banner', () => {
  it('exports a PortalHomeComplianceBanner that renders when any MISSING/EXPIRED/30d-band item exists', async () => {
    const mod = await import(/* @vite-ignore */ BANNER_PATH);
    expect(mod.PortalHomeComplianceBanner).toBeTypeOf('function');
    throw new Error('PortalHomeComplianceBanner not yet implemented');
  });
});
