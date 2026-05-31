// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-05 block modal; component lives in
// apps/web-vite/src/components/payments/payment-block-modal.tsx (Plan 72-07).

import { describe, expect, it } from 'vitest';

describe('payment-block-modal', () => {
  it('renders per-contractor sections with deep links to expired documents', async () => {
    // Indirect specifier keeps Vite's static import-analysis from pre-resolving
    // the (intentionally absent) module at transform time, so the suite still
    // collects and this case fails at runtime per threat T-72-01-05.
    const specifier = '../payment-block-modal';
    const mod = await import(/* @vite-ignore */ specifier);
    expect(mod.PaymentBlockModal).toBeTypeOf('function');
    throw new Error('PaymentBlockModal not yet implemented');
  });

  it('shows i18n locked-phrase document type labels', async () => {
    throw new Error('i18n labelKey resolution not yet implemented');
  });

  it('renders empty state gracefully when contractorReasons is []', async () => {
    throw new Error('empty-state guard not yet implemented');
  });
});

describe('payment-wizard error-handling', () => {
  it('catches PRECONDITION_FAILED tRPC error and opens block modal with cause payload', async () => {
    throw new Error('wizard error-handling not yet implemented');
  });
});
