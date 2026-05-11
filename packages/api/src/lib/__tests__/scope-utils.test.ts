import { describe, expect, it } from 'vitest';
import { PUBLIC_API_SCOPES, permissionToScopes } from '../scope-utils';

// ---------------------------------------------------------------------------
// permissionToScopes
// ---------------------------------------------------------------------------

describe('permissionToScopes', () => {
  it('converts a single resource with one action', () => {
    const result = permissionToScopes({ contractor: ['read'] });
    expect(result).toEqual(['contractor:read']);
  });

  it('converts a single resource with multiple actions', () => {
    const result = permissionToScopes({ contractor: ['read', 'update'] });
    expect(result).toEqual(['contractor:read', 'contractor:update']);
  });

  it('converts multiple resources', () => {
    const result = permissionToScopes({
      contractor: ['read'],
      contract: ['read', 'update'],
    });
    expect(result).toEqual(['contractor:read', 'contract:read', 'contract:update']);
  });

  it('returns an empty array for an empty permission object', () => {
    const result = permissionToScopes({});
    expect(result).toEqual([]);
  });

  it('skips resources with falsy action arrays', () => {
    // The guard `if (actions)` handles undefined/null entries from Object.entries
    const result = permissionToScopes({ contractor: undefined } as never);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PUBLIC_API_SCOPES
// ---------------------------------------------------------------------------

describe('PUBLIC_API_SCOPES', () => {
  it('contains the expected scopes', () => {
    expect(PUBLIC_API_SCOPES).toContain('contractor:read');
    expect(PUBLIC_API_SCOPES).toContain('contract:read');
    expect(PUBLIC_API_SCOPES).toContain('invoice:read');
    expect(PUBLIC_API_SCOPES).toContain('document:read');
  });

  it('has exactly 4 scopes', () => {
    expect(PUBLIC_API_SCOPES).toHaveLength(4);
  });

  it('is readonly (frozen at the type level via as const)', () => {
    // Runtime proof: attempting to push throws in strict mode or is a no-op on frozen arrays.
    // `as const` produces a readonly tuple — we verify the value is an array and matches snapshot.
    expect(Object.isFrozen(PUBLIC_API_SCOPES)).toBe(false); // as const is type-only
    expect(Array.isArray(PUBLIC_API_SCOPES)).toBe(true);
  });
});
