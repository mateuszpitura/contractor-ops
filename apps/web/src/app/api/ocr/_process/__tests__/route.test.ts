/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProcessOcrExtraction = vi.fn();

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/ocr-extraction', () => ({
  processOcrExtraction: (...args: unknown[]) => mockProcessOcrExtraction(...args),
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/ocr/_process', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/ocr/_process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessOcrExtraction.mockResolvedValue(undefined);
  });

  it('returns 400 when extractionId, organizationId, or storageKey is missing', async () => {
    const res = await POST(postJson({ extractionId: 'e1', organizationId: 'o1' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('Missing');
  });

  it('calls processOcrExtraction and returns 200 on success', async () => {
    const res = await POST(
      postJson({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'key-1',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockProcessOcrExtraction).toHaveBeenCalledWith({
      extractionId: 'ext-1',
      organizationId: 'org-1',
      storageKey: 'key-1',
    });
    expect(await res.json()).toEqual({ processed: true });
  });

  it('returns 500 when processOcrExtraction throws', async () => {
    mockProcessOcrExtraction.mockRejectedValueOnce(new Error('OCR failed'));

    const res = await POST(
      postJson({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'key-1',
      }),
    );

    expect(res.status).toBe(500);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'Processing failed',
    });
  });
});
