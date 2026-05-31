import { describe, expect, it } from 'vitest';
import { getFlagSignoff, isGatedFlag } from '../signoff-registry-flags';

describe('idp-deprovisioning signoff entry (Phase 76)', () => {
  it('is recognised as a gated namespace flag', () => {
    expect(isGatedFlag('idp-deprovisioning')).toBe(true);
  });

  it('has a registry entry with status PENDING (until legal review post-deploy)', () => {
    const entry = getFlagSignoff('idp-deprovisioning');
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('PENDING');
  });
});
