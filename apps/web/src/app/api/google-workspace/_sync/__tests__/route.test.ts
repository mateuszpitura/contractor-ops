/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProcessDirectorySync = vi.fn();

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/google-workspace-sync-orchestrator', () => ({
  processDirectorySync: (...args: unknown[]) => mockProcessDirectorySync(...args),
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/google-workspace/_sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/google-workspace/_sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessDirectorySync.mockResolvedValue({ changes: 1 });
  });

  it('returns 400 when body fails Zod validation', async () => {
    const res = await POST(postJson({ organizationId: '', connectionId: 'c1' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request body');
  });

  it('calls processDirectorySync and returns 200 with merged result', async () => {
    const res = await POST(postJson({ organizationId: 'org-1', connectionId: 'conn-1' }));

    expect(res.status).toBe(200);
    expect(mockProcessDirectorySync).toHaveBeenCalledWith({
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });
    expect(await res.json()).toEqual({
      processed: true,
      changes: 1,
    });
  });

  it('returns 500 when processDirectorySync throws', async () => {
    mockProcessDirectorySync.mockRejectedValueOnce(new Error('GWS failed'));

    const res = await POST(postJson({ organizationId: 'org-1', connectionId: 'conn-1' }));

    expect(res.status).toBe(500);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'Google Workspace directory sync failed',
    });
  });
});
