/** @vitest-environment node */

import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEncryptToken, mockSyncWorkspaceUsers, mockFindFirst, mockCreate, mockUpdate } =
  vi.hoisted(() => ({
    mockEncryptToken: vi.fn(),
    mockSyncWorkspaceUsers: vi.fn(),
    mockFindFirst: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
  }));

vi.mock('@contractor-ops/api/services/slack-client', () => ({
  encryptToken: mockEncryptToken,
  syncWorkspaceUsers: mockSyncWorkspaceUsers,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

// Mock global fetch for Slack token exchange
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from '../route';

const SIGNING_SECRET = 'test-signing-secret';

function makeState(
  overrides: Partial<{ orgId: string; userId: string; timestamp: number }> = {},
): string {
  const orgId = overrides.orgId ?? 'org-1';
  const userId = overrides.userId ?? 'user-1';
  const timestamp = overrides.timestamp ?? Date.now();

  const payload = `${orgId}:${userId}:${timestamp}`;
  const sig = createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

  return Buffer.from(JSON.stringify({ orgId, userId, timestamp, sig })).toString('base64url');
}

describe('GET /api/slack/oauth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
    process.env.SLACK_CLIENT_ID = 'test-client-id';
    process.env.SLACK_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost';

    mockEncryptToken.mockReturnValue('encrypted-token');
    mockSyncWorkspaceUsers.mockResolvedValue({ synced: 3 });
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'conn-new' });
    mockUpdate.mockResolvedValue({ id: 'conn-upd' });

    mockFetch.mockResolvedValue({
      json: async () => ({
        ok: true,
        access_token: 'xoxb-test-token',
        team: { id: 'T123', name: 'Test Workspace' },
      }),
    });
  });

  it('redirects with error when code or state is missing', async () => {
    const req = new NextRequest('http://localhost/api/slack/oauth');
    const res = await GET(req);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=error');
  });

  it('redirects with error when state has invalid signature', async () => {
    const badState = Buffer.from(
      JSON.stringify({ orgId: 'org-1', userId: 'user-1', timestamp: Date.now(), sig: 'badsig' }),
    ).toString('base64url');

    const req = new NextRequest(`http://localhost/api/slack/oauth?code=abc&state=${badState}`);
    const res = await GET(req);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=error');
  });

  it('redirects with error when state is expired (>10 minutes)', async () => {
    const expiredState = makeState({ timestamp: Date.now() - 15 * 60 * 1000 });

    const req = new NextRequest(`http://localhost/api/slack/oauth?code=abc&state=${expiredState}`);
    const res = await GET(req);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=error');
  });

  it('redirects with error when Slack token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, error: 'invalid_code' }),
    });

    const state = makeState();
    const req = new NextRequest(`http://localhost/api/slack/oauth?code=badcode&state=${state}`);
    const res = await GET(req);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=error');
  });

  it('creates new IntegrationConnection and redirects to connected on success', async () => {
    const state = makeState();
    const req = new NextRequest(`http://localhost/api/slack/oauth?code=valid-code&state=${state}`);
    const res = await GET(req);

    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe(
      'http://localhost/settings?tab=integrations&slack=connected',
    );

    expect(mockEncryptToken).toHaveBeenCalledWith('xoxb-test-token');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          provider: 'SLACK',
          status: 'CONNECTED',
          displayName: 'Test Workspace',
          credentialsRef: 'encrypted-token',
          connectedByUserId: 'user-1',
          configJson: { teamId: 'T123' },
        }),
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSyncWorkspaceUsers).toHaveBeenCalledWith('org-1', 'conn-new');
  });

  it('updates existing IntegrationConnection when one exists', async () => {
    mockFindFirst.mockResolvedValue({ id: 'conn-existing' });

    const state = makeState();
    const req = new NextRequest(`http://localhost/api/slack/oauth?code=valid-code&state=${state}`);
    await GET(req);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-existing' },
        data: expect.objectContaining({
          status: 'CONNECTED',
          displayName: 'Test Workspace',
          credentialsRef: 'encrypted-token',
        }),
      }),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('redirects with error when SLACK_CLIENT_ID is missing', async () => {
    delete process.env.SLACK_CLIENT_ID;

    const state = makeState();
    const req = new NextRequest(`http://localhost/api/slack/oauth?code=c&state=${state}`);
    const res = await GET(req);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=error');
  });

  it('still redirects to connected when syncWorkspaceUsers fails (non-blocking)', async () => {
    mockSyncWorkspaceUsers.mockRejectedValueOnce(new Error('sync failed'));

    const state = makeState();
    const req = new NextRequest(`http://localhost/api/slack/oauth?code=valid-code&state=${state}`);
    const res = await GET(req);

    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('slack=connected');
  });
});
