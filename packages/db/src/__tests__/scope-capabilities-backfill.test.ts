// Tests for the scopeCapabilities backfill script
// (`backfill-scope-capabilities.ts` + the `ScopeCapabilities` type).

import { describe, expect, it } from 'vitest';
import { backfillScopeCapabilities } from '../../scripts/backfill-scope-capabilities.js';
import type { ScopeCapabilities } from '../types/scope-capabilities.js';

describe('scopeCapabilities backfill (FOUND6-05 — D-14)', () => {
  it('writes directory.read + group.read for every existing GOOGLE_WORKSPACE connection with null scopeCapabilities', async () => {
    const connections = [
      { id: 'c1', provider: 'GOOGLE_WORKSPACE' as const, scopeCapabilities: null },
      { id: 'c2', provider: 'GOOGLE_WORKSPACE' as const, scopeCapabilities: null },
      { id: 'c3', provider: 'SLACK' as const, scopeCapabilities: null },
    ];
    const updates = await backfillScopeCapabilities({ connections, dryRun: true });
    expect(updates).toHaveLength(2);
    const gws = updates.filter(
      u => u.connectionId.startsWith('c1') || u.connectionId.startsWith('c2'),
    );
    for (const u of gws) {
      const caps = u.scopeCapabilities as ScopeCapabilities;
      expect(caps.provider).toBe('google');
      expect(caps.capabilities).toContain('directory.read');
      expect(caps.capabilities).toContain('group.read');
    }
  });

  it('is idempotent — connections with non-null scopeCapabilities are skipped', async () => {
    const connections = [
      {
        id: 'c1',
        provider: 'GOOGLE_WORKSPACE' as const,
        scopeCapabilities: {
          provider: 'google',
          scopes: [],
          capabilities: ['directory.read'],
          grantedAt: '2026-04-26T00:00:00.000Z',
        },
      },
    ];
    const updates = await backfillScopeCapabilities({ connections, dryRun: true });
    expect(updates).toEqual([]);
  });
});
