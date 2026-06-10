import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAdapter } from '../adapters/base-adapter.js';
import type { ImpactPreview } from '../idp/impact-preview.js';
import {
  clearAdapters,
  getDeprovisionableAdapter,
  registerDeprovisionableAdapter,
} from '../registry.js';
import {
  GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES,
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
} from '../scopes/google-workspace-deprovision-scopes.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';

// Compile-time guarantee: this class only compiles if Deprovisionable requires
// all four methods. Removing any method below would fail typecheck.
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
  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    return {
      provider: 'GOOGLE_WORKSPACE',
      commonMetrics: {
        externalUserId,
        externalUserDisplayName: 'Test User',
        accountStatus: 'ACTIVE',
        sessionCount: null,
      },
      customMetrics: { oauthGrants: [], isSuperAdmin: false, drivesOwnedCount: null },
      fetchedAt: new Date().toISOString(),
    };
  }
}

describe('Deprovisionable interface', () => {
  beforeEach(() => clearAdapters());

  it('exports Deprovisionable with suspendAccount + revokeAllSessions + verifyDeprovisioned', () => {
    const a = new TestDeprovisionableAdapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
  });

  it('registry warns and overwrites on double registration (tolerates Vitest-worker leakage)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = new TestDeprovisionableAdapter();
    const b = new TestDeprovisionableAdapter();
    registerDeprovisionableAdapter('GOOGLE_WORKSPACE', a);
    // Second registration must NOT throw — it overwrites silently (logger.warn via Pino,
    // not console.warn, so we just verify no throw and the new instance wins).
    expect(() => registerDeprovisionableAdapter('GOOGLE_WORKSPACE', b)).not.toThrow();
    expect(getDeprovisionableAdapter('GOOGLE_WORKSPACE')).toBe(b);
    warnSpy.mockRestore();
  });

  it('registry getDeprovisionableAdapter throws for unregistered provider', () => {
    expect(() => getDeprovisionableAdapter('SLACK')).toThrow(/No Deprovisionable adapter/);
  });

  it('registry getDeprovisionableAdapter returns the registered instance', () => {
    const a = new TestDeprovisionableAdapter();
    registerDeprovisionableAdapter('GOOGLE_WORKSPACE', a);
    expect(getDeprovisionableAdapter('GOOGLE_WORKSPACE')).toBe(a);
  });

  it('GOOGLE_WORKSPACE_DEPROVISION_SCOPES exports the directory + user.security scopes', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_SCOPES).toEqual([
      'https://www.googleapis.com/auth/admin.directory.user',
      // token revoke + sign-out sub-actions of revokeAllSessions.
      'https://www.googleapis.com/auth/admin.directory.user.security',
    ]);
  });

  it('GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES exports user.deprovision + directory.write', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('user.deprovision');
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('directory.write');
  });
});
