// Phase 73 Wave 0 — Nyquist failing scaffold (web-vite)
// Maps to COMPL-01 manual admin override modal; view lives in
// apps/web-vite/src/components/contractors/compliance/override-compliance-item-dialog.tsx (Plan 73-08).

import { describe, expect, it } from 'vitest';

// Vite resolves a static `await import('literal')` at transform time, which would
// fail the whole suite (collection error) instead of the assertion. Indirecting the
// specifier through a variable + `@vite-ignore` keeps the failure at runtime so the
// named test case fails as a deterministic Nyquist RED until Plan 73-08 lands the view.
const VIEW_PATH = '../override-compliance-item-dialog';

describe('override-compliance-item-dialog render', () => {
  it('mounts with closed Select for reasonCategory + Textarea for reasonNote', async () => {
    const mod = await import(/* @vite-ignore */ VIEW_PATH);
    expect(mod.OverrideComplianceItemDialogView).toBeTypeOf('function');
    throw new Error('OverrideComplianceItemDialogView not yet implemented');
  });

  it('renders all 6 WaivedReasonCategory options in the Select dropdown', async () => {
    throw new Error('reason-options enumeration not yet implemented');
  });
});

describe('override-compliance-item-dialog validation', () => {
  it('disables submit button when reasonCategory is null', async () => {
    throw new Error('disabled-when-no-category guard not yet implemented');
  });

  it('disables submit button when reasonNote is shorter than 20 chars', async () => {
    throw new Error('disabled-when-note-too-short guard not yet implemented');
  });

  it('enables submit button when both inputs are valid', async () => {
    throw new Error('enabled-when-both-valid not yet implemented');
  });
});

describe('override-compliance-item-dialog submit', () => {
  it('invokes the use-override-compliance-item mutation on submit (trpc.classification.overrideItem)', async () => {
    throw new Error('mutation-call not yet implemented');
  });

  it('toasts success and closes dialog on mutation success', async () => {
    throw new Error('success-toast not yet implemented');
  });
});
