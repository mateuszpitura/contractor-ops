/** @vitest-environment node */

// Phase 76 SC#3 — Google Workspace OAuth callback scopeCapabilities derivation.
// Verifies the buildGoogleWorkspaceScopeCapabilities helper (apps/api/src/routes/oauth.ts)
// and that the GWS adapter's getOAuthConfig forces prompt=consent + carries the additive
// write scope traced to the typed-const.

import {
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
  getAdapter,
  registerAllAdapters,
} from '@contractor-ops/integrations';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildGoogleWorkspaceScopeCapabilities } from '../routes/oauth.js';

const READONLY_SCOPES =
  'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly';
const WRITE_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';

beforeAll(() => {
  registerAllAdapters();
});

describe('Google Workspace OAuth callback (Phase 76 SC#3)', () => {
  it('write-access consent grants directory.write + user.deprovision into scopeCapabilities', () => {
    const caps = buildGoogleWorkspaceScopeCapabilities(`${READONLY_SCOPES} ${WRITE_SCOPE}`);
    expect(caps.provider).toBe('google');
    expect(caps.capabilities).toContain('user.deprovision');
    expect(caps.capabilities).toContain('directory.write');
    expect(caps.scopes).toContain(WRITE_SCOPE);
  });

  it('preserves existing read-only capabilities (additive — directory.read kept, no write caps)', () => {
    const caps = buildGoogleWorkspaceScopeCapabilities(READONLY_SCOPES);
    expect(caps.capabilities).toContain('directory.read');
    expect(caps.capabilities).not.toContain('directory.write');
    expect(caps.capabilities).not.toContain('user.deprovision');
  });

  it('OAuth config includes prompt=consent and the additive write scope (write-access flow)', () => {
    const adapter = getAdapter('google_workspace');
    const config = adapter?.getOAuthConfig?.();
    expect(config?.extraAuthParams?.prompt).toBe('consent');
    for (const scope of GOOGLE_WORKSPACE_DEPROVISION_SCOPES) {
      expect(config?.scopes).toContain(scope);
    }
    // Read-only scopes preserved (additive, not replaced).
    expect(config?.scopes).toContain(
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    );
  });
});
