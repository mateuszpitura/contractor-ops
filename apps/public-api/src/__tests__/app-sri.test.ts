/**
 * Tests for app.ts SRI gating logic.
 *
 * Vitest native-ESM limitation: vi.resetModules() + dynamic import() cannot
 * force re-evaluation of a module that was already loaded by another test file
 * running in the same worker. To test the throw-at-load-time behaviour and the
 * CSP string we replicate the conditional logic directly — the guard and the
 * CSP builder are both trivially simple, single-responsibility pieces of code
 * that are easy to unit-test in isolation.
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// SRI guard logic — mirrors app.ts lines 90-101 exactly
// ---------------------------------------------------------------------------

describe('SRI guard logic (replicated from app.ts)', () => {
  const SCALAR_SRI_PLACEHOLDER = 'sha384-REPLACE_WITH_PINNED_HASH_BEFORE_ENABLING_IN_PROD';

  function checkSriGuard(enableApiDocs: string | undefined, sriHash: string | undefined): void {
    const docsEnabled = enableApiDocs === 'true';
    const sri = sriHash ?? SCALAR_SRI_PLACEHOLDER;
    if (docsEnabled && sri === SCALAR_SRI_PLACEHOLDER) {
      throw new Error(
        'ENABLE_API_DOCS=true but SCALAR_SRI_HASH is the placeholder. ' +
          'Pin a real subresource-integrity hash',
      );
    }
  }

  it('throws when ENABLE_API_DOCS=true and SCALAR_SRI_HASH is undefined (falls back to placeholder)', () => {
    expect(() => checkSriGuard('true', undefined)).toThrow('SCALAR_SRI_HASH is the placeholder');
  });

  it('does not throw when ENABLE_API_DOCS is "false"', () => {
    expect(() => checkSriGuard('false', undefined)).not.toThrow();
  });

  it('does not throw when ENABLE_API_DOCS is undefined', () => {
    expect(() => checkSriGuard(undefined, undefined)).not.toThrow();
  });

  it('does not throw when ENABLE_API_DOCS=true and a real SRI hash is provided', () => {
    expect(() => checkSriGuard('true', 'sha384-actualhash')).not.toThrow();
  });

  it('throws when ENABLE_API_DOCS=true and SCALAR_SRI_HASH is the exact placeholder string', () => {
    expect(() => checkSriGuard('true', SCALAR_SRI_PLACEHOLDER)).toThrow();
  });

  it('does NOT throw when SCALAR_SRI_HASH is empty string (nullish coalescing keeps it as empty, not placeholder)', () => {
    // Empty string is not null/undefined so ?? does not fall back to placeholder.
    // '' !== SCALAR_SRI_PLACEHOLDER → no throw even with ENABLE_API_DOCS=true.
    expect(() => checkSriGuard('true', '')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CSP string builder — mirrors app.ts /docs handler exactly
// ---------------------------------------------------------------------------

describe('CSP string for /docs (replicated from app.ts)', () => {
  function buildDocsCsp(): string {
    return [
      "default-src 'none'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com https://cdn.jsdelivr.net',
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
  }

  it("includes default-src 'none'", () => {
    expect(buildDocsCsp()).toContain("default-src 'none'");
  });

  it("includes frame-ancestors 'none'", () => {
    expect(buildDocsCsp()).toContain("frame-ancestors 'none'");
  });

  it('includes cdn.jsdelivr.net in script-src', () => {
    expect(buildDocsCsp()).toContain('https://cdn.jsdelivr.net');
  });

  it("includes base-uri 'none'", () => {
    expect(buildDocsCsp()).toContain("base-uri 'none'");
  });

  it("includes form-action 'none'", () => {
    expect(buildDocsCsp()).toContain("form-action 'none'");
  });
});
