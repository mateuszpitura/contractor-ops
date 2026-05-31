// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-05 feature-flag gating; entry lives in
// packages/feature-flags/src/signoff-registry-flags.json (Plan 72-08).

import { describe, expect, it } from 'vitest';
import rawRegistry from '../signoff-registry-flags.json' with { type: 'json' };

describe('compliance-payment-block-entry', () => {
  it('signoff-registry-flags.json contains compliance-payment-block PENDING entry', () => {
    const registry = rawRegistry as Record<string, { status: string; notes: string }>;
    const entry = registry['compliance-payment-block'];
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('PENDING');
    expect(entry?.notes).toMatch(/F1 Compliance hard payment-block/i);
  });

  it('compliance-payment-block matches the compliance- gated namespace prefix', async () => {
    const { isGatedFlag } = await import('../signoff-registry-flags.js');
    expect(isGatedFlag('compliance-payment-block')).toBe(true);
  });
});
