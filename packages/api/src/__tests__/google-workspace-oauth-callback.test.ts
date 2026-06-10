import {
  GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES,
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
} from '@contractor-ops/integrations';
import { describe, expect, it } from 'vitest';

// The OAuth callback's scopeCapabilities derivation + prompt=consent flow is a
// Fastify route (apps/api/src/routes/oauth.ts); the full behavioural test lives at
// apps/api/src/__tests__/google-workspace-oauth-callback.test.ts. Here we lock the
// integrations-level contract those callbacks depend on (the typed-const scope + capabilities).

describe('Google Workspace OAuth callback contract (Phase 76 SC#3)', () => {
  it('the write scope the callback grants is the additive admin.directory.user (not .readonly)', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_SCOPES).toContain(
      'https://www.googleapis.com/auth/admin.directory.user',
    );
    expect(GOOGLE_WORKSPACE_DEPROVISION_SCOPES).not.toContain(
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    );
  });

  it('the capabilities the callback writes are valid CapabilityEnum members (user.deprovision + directory.write)', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('user.deprovision');
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).toContain('directory.write');
  });

  it('the capability set is additive (does not include any read-only-erasing marker)', () => {
    expect(GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES).not.toContain('directory.read');
  });
});
