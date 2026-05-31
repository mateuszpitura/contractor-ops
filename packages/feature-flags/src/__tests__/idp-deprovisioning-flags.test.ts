import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags-core';
import { getFlagSignoff, isGatedFlag } from '../signoff-registry-flags';

// Phase 77 D-15 — per-provider IdP deprovisioning flags. Both ship dark
// (default false) and are gated behind a PENDING signoff entry so they cannot
// be enabled per-org until legal review flips the registry to APPROVED.

const PROVIDER_FLAG_KEYS = [
  'module.idp-deprovisioning-gws',
  'module.idp-deprovisioning-slack',
] as const;

describe('IdP deprovisioning per-provider flags (Phase 77 D-15)', () => {
  for (const key of PROVIDER_FLAG_KEYS) {
    describe(key, () => {
      it('is declared in FLAGS', () => {
        expect(FLAGS).toHaveProperty(key);
      });

      it('ships dark (default false) in the module category', () => {
        const def = FLAGS[key as keyof typeof FLAGS];
        expect(def.default).toBe(false);
        expect(def.category).toBe('module');
        expect(def.jurisdiction).toBe('ANY');
      });

      it('is recognised as a gated-namespace flag', () => {
        expect(isGatedFlag(key)).toBe(true);
      });

      it('has a PENDING signoff registry entry', () => {
        const entry = getFlagSignoff(key);
        expect(entry).toBeDefined();
        expect(entry?.status).toBe('PENDING');
      });
    });
  }

  it('the two provider flags are independent keys (D-15 per-provider gating)', () => {
    expect(PROVIDER_FLAG_KEYS[0]).not.toBe(PROVIDER_FLAG_KEYS[1]);
    expect(getFlagSignoff('module.idp-deprovisioning-gws')).not.toBe(
      getFlagSignoff('module.idp-deprovisioning-slack'),
    );
  });

  it('does not disturb the Phase 76 saga-level idp-deprovisioning signoff entry', () => {
    expect(getFlagSignoff('idp-deprovisioning')?.status).toBe('PENDING');
  });
});
