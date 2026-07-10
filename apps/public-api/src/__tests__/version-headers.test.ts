/**
 * RFC 8594 Sunset/Deprecation headers.
 *
 * A `versionHeaders` middleware must emit `Sunset` + `Link; rel="sunset"` +
 * `Deprecation` ONLY when a version policy sets them — the mechanism exists even
 * though the current `v1` has no sunset (nothing emitted yet).
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { VERSION_POLICY, versionHeaders } from '../lib/version-headers.js';

function appWith() {
  const app = new Hono();
  app.use('*', versionHeaders);
  app.get('/ping', c => c.json({ ok: true }));
  return app;
}

describe('versionHeaders middleware', () => {
  it('emits NO Sunset header for the current v1 (no sunset policy)', async () => {
    const res = await appWith().request('/ping');
    expect(res.headers.get('sunset')).toBeNull();
  });

  it('emits RFC 8594 Sunset + Link when a policy sets a sunset date', async () => {
    // The test drives a policy with a sunset date to prove the mechanism fires.
    const original = VERSION_POLICY.v1;
    VERSION_POLICY.v1 = {
      ...original,
      deprecation: new Date('2027-01-01T00:00:00Z'),
      sunset: new Date('2027-06-01T00:00:00Z'),
      policyUrl: 'https://api.contractor-ops.com/versioning',
    };
    try {
      const res = await appWith().request('/ping');
      expect(res.headers.get('sunset')).toBeTruthy();
      expect(res.headers.get('deprecation')).toBeTruthy();
      expect(res.headers.get('link') ?? '').toContain('rel="sunset"');
    } finally {
      VERSION_POLICY.v1 = original;
    }
  });
});
