// Verifies the compliance-portal-self-service signoff-registry entry.

import { describe, expect, it } from 'vitest';
import rawRegistry from '../signoff-registry-flags.json' with { type: 'json' };

describe('compliance-portal-self-service-entry', () => {
  it('signoff-registry-flags.json contains a compliance-portal-self-service PENDING entry', () => {
    const registry = rawRegistry as Record<string, { status: string; notes: string }>;
    const entry = registry['compliance-portal-self-service'];
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('PENDING');
    expect(entry?.notes).toMatch(/portal compliance self-service|self-service/i);
  });

  it('compliance-portal-self-service matches the compliance- gated namespace prefix', async () => {
    const { isGatedFlag } = await import('../signoff-registry-flags.js');
    expect(isGatedFlag('compliance-portal-self-service')).toBe(true);
  });
});
