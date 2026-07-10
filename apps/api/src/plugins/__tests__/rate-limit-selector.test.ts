import { describe, expect, it } from 'vitest';

import { usesPortalLimiter } from '../rate-limit.js';

/**
 * B-3 regression: portal tRPC lives at `/api/trpc/portal/*`. It must select the
 * strict 10/min portal bucket, not the 60/min API bucket that staff
 * `/api/trpc/*` uses.
 */
describe('usesPortalLimiter', () => {
  it('selects the portal limiter for portal tRPC procedures', () => {
    expect(usesPortalLimiter('/api/trpc/portal/portal.requestMagicLink')).toBe(true);
    expect(usesPortalLimiter('/api/trpc/portal/portal.getSession?batch=1&input=%7B%7D')).toBe(true);
  });

  it('selects the portal limiter for the legacy /api/portal + /portal REST routes', () => {
    expect(usesPortalLimiter('/api/portal/anything')).toBe(true);
    expect(usesPortalLimiter('/portal/set-session')).toBe(true);
    expect(usesPortalLimiter('/portal/clear-session')).toBe(true);
  });

  it('does NOT select the portal limiter for staff tRPC procedures', () => {
    expect(usesPortalLimiter('/api/trpc/contractor.list')).toBe(false);
    expect(usesPortalLimiter('/api/trpc/dashboard.kpis?batch=1')).toBe(false);
  });

  it('does not let a hypothetical staff namespace prefixed "portal" leak into the portal bucket', () => {
    // Portal procedures are always `/api/trpc/portal/<proc>` (trailing slash);
    // a staff `/api/trpc/portalfoo` must stay on the API bucket.
    expect(usesPortalLimiter('/api/trpc/portalfoo.list')).toBe(false);
  });

  it('does not select the portal limiter for generic API routes', () => {
    expect(usesPortalLimiter('/api/contractors')).toBe(false);
    expect(usesPortalLimiter('/health')).toBe(false);
  });
});
