/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockProcessKsefSync,
} = vi.hoisted(() => ({
  mockProcessKsefSync: vi.fn(),
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/ksef-sync-orchestrator', () => ({
  processKsefSync: mockProcessKsefSync,
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/ksef/_sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/ksef/_sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessKsefSync.mockResolvedValue({ imported: 2 });
  });

  it('returns 400 when organizationId or connectionId is missing', async () => {
    const res = await POST(postJson({ organizationId: 'o1' }));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('Missing'),
    });
  });

  it('calls processKsefSync and returns 200 with result fields', async () => {
    const res = await POST(postJson({ organizationId: 'org-1', connectionId: 'conn-1' }));

    expect(res.status).toBe(200);
    expect(mockProcessKsefSync).toHaveBeenCalledWith({
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });
    expect(await res.json()).toEqual({
      processed: true,
      imported: 2,
    });
  });

  it('returns 500 when processKsefSync throws', async () => {
    mockProcessKsefSync.mockRejectedValueOnce(new Error('sync failed'));

    const res = await POST(postJson({ organizationId: 'org-1', connectionId: 'conn-1' }));

    expect(res.status).toBe(500);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'KSeF sync failed',
    });
  });
});
