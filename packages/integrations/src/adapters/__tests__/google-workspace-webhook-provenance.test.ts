import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock idp-saga so handleWebhook's provenanceLookup is controllable + does not hit a DB.
vi.mock('@contractor-ops/idp-saga', () => ({
  provenanceLookup: vi.fn(),
}));
// Mock db so importing the adapter does not construct a real Prisma client.
vi.mock('@contractor-ops/db', () => ({ prisma: {} }));

import { provenanceLookup } from '@contractor-ops/idp-saga';
import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const lookup = vi.mocked(provenanceLookup);

describe('GoogleWorkspaceAdapter.handleWebhook (Phase 76 D-09..D-12)', () => {
  beforeEach(() => lookup.mockReset());

  it('user.suspended event with matching provenance returns { suppressed: true }', async () => {
    lookup.mockResolvedValue({ id: 'p-1' });
    const result = await new GoogleWorkspaceAdapter().handleWebhook(
      { event: 'user.suspended', userId: 'u@example.com' },
      'org-1',
      'conn-1',
    );
    expect(result).toEqual({ suppressed: true, provenanceId: 'p-1' });
    expect(lookup).toHaveBeenCalledWith(expect.anything(), {
      organizationId: 'org-1',
      provider: 'GOOGLE_WORKSPACE',
      externalUserId: 'u@example.com',
      actionKind: 'SUSPEND',
    });
  });

  it('user.suspended without a provenance match falls through (returns undefined)', async () => {
    lookup.mockResolvedValue(null);
    const result = await new GoogleWorkspaceAdapter().handleWebhook(
      { event: 'user.suspended', userId: 'u@example.com' },
      'org-1',
      'conn-1',
    );
    expect(result).toBeUndefined();
  });

  it('non-user.suspended events bypass the provenance lookup entirely', async () => {
    const result = await new GoogleWorkspaceAdapter().handleWebhook(
      { event: 'group.created', groupId: 'g-1' },
      'org-1',
      'conn-1',
    );
    expect(result).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('payload missing the event field is silently ignored (no lookup, no throw)', async () => {
    await expect(
      new GoogleWorkspaceAdapter().handleWebhook({ random: 'shape' }, 'org-1', 'conn-1'),
    ).resolves.toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });
});
