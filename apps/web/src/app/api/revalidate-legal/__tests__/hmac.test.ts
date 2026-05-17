import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from 'next/cache';
import { POST } from '../route';

const SECRET = 'unit-test-secret-key';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
}

function buildRequest(body: string, signature: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature !== null) {
    headers.set('x-cms-signature', signature);
  }
  return new Request('http://localhost/api/revalidate-legal', {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/revalidate-legal', () => {
  beforeEach(() => {
    process.env.CMS_WEBHOOK_SECRET = SECRET;
    vi.mocked(revalidateTag).mockReset();
  });

  it('rejects missing signature with 401', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'eu' });
    const res = await POST(buildRequest(body, null));
    expect(res.status).toBe(401);
  });

  it('rejects wrong signature with 401', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'eu' });
    const res = await POST(buildRequest(body, 'deadbeef'));
    expect(res.status).toBe(401);
  });

  it('rejects malformed JSON with 400', async () => {
    const body = '{not json';
    const res = await POST(buildRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it('rejects missing fields with 400', async () => {
    const body = JSON.stringify({ type: 'privacy' });
    const res = await POST(buildRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it('accepts a valid signed payload and revalidates the tag', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'eu' });
    const res = await POST(buildRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; tag: string };
    expect(json).toEqual({ ok: true, tag: 'legal:privacy:eu' });
    expect(revalidateTag).toHaveBeenCalledWith('legal:privacy:eu', 'max');
  });

  it('returns 500 when CMS_WEBHOOK_SECRET is unset', async () => {
    process.env.CMS_WEBHOOK_SECRET = '';
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'eu' });
    const res = await POST(buildRequest(body, sign(body)));
    expect(res.status).toBe(500);
  });
});
