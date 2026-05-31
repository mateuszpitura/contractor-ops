import { beforeEach, describe, expect, it } from 'vitest';
import { BaseAdapter } from '../adapters/base-adapter.js';
import {
  _resetDeprovisionableAdapters,
  getDeprovisionableAdapter,
  registerDeprovisionableAdapter,
} from '../registry.js';
import {
  GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES,
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
} from '../scopes/google-workspace-deprovision-scopes.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';

// Compile-time guarantee (D-13 / SC#5): this class only compiles if Deprovisionable
// requires all three methods. Removing any method below would fail typecheck.
class TestDeprovisionableAdapter extends BaseAdapter implements Deprovisionable {
  readonly slug = 'test-deprovisionable';
  readonly displayName = 'Test Deprovisionable';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  async suspendAccount(_externalUserId: string): Promise<DeprovisionResult> {
    return { status: 'SUCCEEDED', requestSha256: 'a'.repeat(64), responseSha256: 'b'.repeat(64) };
  }
  async revokeAllSessions(_externalUserId: string): Promise<DeprovisionResult> {
    return { status: 'SUCCEEDED', requestSha256: 'c'.repeat(64), responseSha256: 'd'.repeat(64) };
  }
  async verifyDeprovisioned(_externalUserId: string): Promise<boolean> {
    return true;
  }
}

describe('Deprovisionable interface (Phase 76 D-13)', () => {
  beforeEach(() => _resetDeprovisionableAdapters());

  it('exports Deprovisionable with suspendAccount + revokeAllSessions + verifyDeprovisioned', () => {
    const a = new TestDeprovisionableAdapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
  });

  it('registry rejects double registration of the same provider', () => {
    const a = new TestDeprovisionableAdapter();
    registerDeprovisionableAdapter('GOOGLE_WORKSPACE', a);
    expect(() => registerDeprovisionableAdapter('GOOGLE_WORKSPACE', a)).toThrow(
      /already registered/,
    );
  });

  it('registry getDeprovisionableAdapter throws for unregistered provider', () => {
    expect(() => getDeprovisionableAdapter('SLACK')).toThrow(/No Deprovisionable adapter/);
  });

  it('registry getDeprovisionableAdapter returns the registered instance', () => {
    const a = new TestDeprovisionableAdapter();
    registerDeprovisionableAdapter('GOOGLE_WORKSPACE', a);
    expect(getDeprovisionableAdapter('GOOGLE_WORKSPACE')).toBe(a);
  });

  it('GOOGLE_WORKSPACE_DEPROVISION_SCOPES exports the admin.directory.user scope', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_SCOPES).toEqual([
      'https://www.googleapis.com/auth/admin.directory.user',
    ]);
  });

  it('GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES exports user.deprovision + directory.write', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('user.deprovision');
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('directory.write');
  });
});
