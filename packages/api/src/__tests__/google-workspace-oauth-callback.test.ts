import { describe, it } from 'vitest';

describe('Google Workspace OAuth callback (Phase 76 SC#3)', () => {
  it.todo(
    'write-access consent grants directory.user.write capability into scopeCapabilities JSONB',
  );
  it.todo('preserves existing read-only capabilities (additive — does not erase directory.read)');
  it.todo('OAuth start URL includes prompt=consent for write-access flow');
});
