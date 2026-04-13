/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPollInPost, mockPollDpd, mockPollUps, mockPrisma } = vi.hoisted(() => {
  const mockPollInPost = vi.fn();
  const mockPollDpd = vi.fn();
  const mockPollUps = vi.fn();
  const mockPrisma = {
    courierConfig: {
      findMany: vi.fn(),
    },
  };
  return { mockPollInPost, mockPollDpd, mockPollUps, mockPrisma };
});

vi.mock('@contractor-ops/api/services/courier/inpost-polling-service', () => ({
  pollInPostShipmentStatuses: mockPollInPost,
}));

vi.mock('@contractor-ops/api/services/courier/dpd-polling-service', () => ({
  pollDpdShipmentStatuses: mockPollDpd,
}));

vi.mock('@contractor-ops/api/services/courier/ups-polling-service', () => ({
  pollUpsShipmentStatuses: mockPollUps,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: Function) => handler,
}));

import { POST } from '../route';

describe('POST /api/cron/inpost-status-poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPollInPost.mockResolvedValue({ checked: 3, updated: 1 });
    mockPollDpd.mockResolvedValue({ checked: 2, updated: 0 });
    mockPollUps.mockResolvedValue({ checked: 1, updated: 1 });
  });

  it('polls all orgs when no organizationId is provided', async () => {
    mockPrisma.courierConfig.findMany.mockResolvedValue([
      { organizationId: 'org-1' },
      { organizationId: 'org-2' },
    ]);

    const req = new NextRequest('http://localhost/api/cron/inpost-status-poll', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { results: unknown[] };
    expect(json.results).toHaveLength(2);
    expect(mockPrisma.courierConfig.findMany).toHaveBeenCalledWith({
      select: { organizationId: true },
      distinct: ['organizationId'],
    });
    // Each org triggers all 3 carriers
    expect(mockPollInPost).toHaveBeenCalledTimes(2);
    expect(mockPollDpd).toHaveBeenCalledTimes(2);
    expect(mockPollUps).toHaveBeenCalledTimes(2);
  });

  it('polls a specific org when organizationId is provided', async () => {
    const req = new NextRequest('http://localhost/api/cron/inpost-status-poll', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-42' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { results: Array<{ organizationId: string; carriers: unknown[] }> };
    expect(json.results).toHaveLength(1);
    expect(json.results[0]!.organizationId).toBe('org-42');
    expect(json.results[0]!.carriers).toHaveLength(3);
    expect(mockPollInPost).toHaveBeenCalledWith(mockPrisma, 'org-42');
    expect(mockPollDpd).toHaveBeenCalledWith(mockPrisma, 'org-42');
    expect(mockPollUps).toHaveBeenCalledWith(mockPrisma, 'org-42');
    // Should NOT query for all configs
    expect(mockPrisma.courierConfig.findMany).not.toHaveBeenCalled();
  });

  it('handles carrier errors gracefully and continues polling other carriers', async () => {
    mockPollInPost.mockRejectedValue(new Error('InPost API timeout'));
    mockPollDpd.mockResolvedValue({ checked: 5, updated: 2 });
    mockPollUps.mockRejectedValue(new Error('UPS auth expired'));

    const req = new NextRequest('http://localhost/api/cron/inpost-status-poll', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-fail' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { results: Array<{ carriers: Array<{ carrier: string; checked: number; updated: number }> }> };
    const carriers = json.results[0]!.carriers;
    // InPost and UPS failed => fallback to {checked:0, updated:0}
    expect(carriers).toEqual([
      { carrier: 'inpost', checked: 0, updated: 0 },
      { carrier: 'dpd', checked: 5, updated: 2 },
      { carrier: 'ups', checked: 0, updated: 0 },
    ]);
  });
});
