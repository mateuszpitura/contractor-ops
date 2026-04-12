/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeletePortalSession } = vi.hoisted(() => ({
  mockDeletePortalSession: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/api/services/portal-session', () => ({
  deletePortalSession: (token: string) => mockDeletePortalSession(token),
}));

import { POST } from '../route';

describe('POST /api/portal/clear-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears cookie without calling delete when no portal_session cookie', async () => {
    const req = new NextRequest('http://localhost/api/portal/clear-session', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDeletePortalSession).not.toHaveBeenCalled();
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('deletes server session then clears cookie when token present', async () => {
    const req = new NextRequest('http://localhost/api/portal/clear-session', {
      method: 'POST',
      headers: { cookie: 'portal_session=token-xyz' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDeletePortalSession).toHaveBeenCalledWith('token-xyz');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie.length).toBeGreaterThan(0);
  });

  it('still returns success and clears cookie when deletePortalSession fails', async () => {
    mockDeletePortalSession.mockRejectedValueOnce(new Error('db unavailable'));
    const req = new NextRequest('http://localhost/api/portal/clear-session', {
      method: 'POST',
      headers: { cookie: 'portal_session=token-err' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDeletePortalSession).toHaveBeenCalledWith('token-err');
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie.length).toBeGreaterThan(0);
  });
});
