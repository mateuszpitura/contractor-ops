/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCredentials, mockPollAndProcessInbound, mockPrisma } = vi.hoisted(() => {
  const mockGetCredentials = vi.fn();
  const mockPollAndProcessInbound = vi.fn();
  const mockPrisma = {
    peppolParticipant: {
      findMany: vi.fn(),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockGetCredentials, mockPollAndProcessInbound, mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations', () => ({
  getCredentials: mockGetCredentials,
}));

vi.mock('@contractor-ops/einvoice', () => ({
  StorecoveAdapter: class {
    constructor() {}
  },
}));

vi.mock('@contractor-ops/api/services/peppol-orchestrator', () => ({
  PeppolOrchestrator: class {
    pollAndProcessInbound = mockPollAndProcessInbound;
  },
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: Function) => handler,
}));

import { POST } from '../route';

describe('POST /api/peppol/poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCredentials.mockResolvedValue({ accessToken: 'tok_test' });
    mockPollAndProcessInbound.mockResolvedValue(3);
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      credentialsRef: 'ref-1',
      configJson: { environment: 'sandbox' },
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});
  });

  it('polls all active participants when no organizationId is provided', async () => {
    mockPrisma.peppolParticipant.findMany.mockResolvedValue([
      { organizationId: 'org-1' },
      { organizationId: 'org-2' },
    ]);

    const req = new NextRequest('http://localhost/api/peppol/poll', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { polled: number; results: unknown[] };
    expect(json.polled).toBe(2);
    expect(json.results).toHaveLength(2);
    expect(mockPrisma.peppolParticipant.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    });
    expect(mockPollAndProcessInbound).toHaveBeenCalledTimes(2);
  });

  it('polls a specific org when organizationId is provided', async () => {
    mockPrisma.peppolParticipant.findMany.mockResolvedValue([
      { organizationId: 'org-42' },
    ]);

    const req = new NextRequest('http://localhost/api/peppol/poll', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-42' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { polled: number; results: Array<{ organizationId: string; processed: number }> };
    expect(json.polled).toBe(1);
    expect(json.results[0]!.organizationId).toBe('org-42');
    expect(json.results[0]!.processed).toBe(3);
    expect(mockPrisma.peppolParticipant.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-42', status: 'ACTIVE' },
    });
  });

  it('returns early with zero results when no connection exists', async () => {
    mockPrisma.peppolParticipant.findMany.mockResolvedValue([
      { organizationId: 'org-no-conn' },
    ]);
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/peppol/poll', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-no-conn' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { polled: number; results: unknown[] };
    expect(json.polled).toBe(0);
    expect(json.results).toHaveLength(0);
    expect(mockPollAndProcessInbound).not.toHaveBeenCalled();
  });

  it('handles poll errors and records error on integration connection', async () => {
    mockPrisma.peppolParticipant.findMany.mockResolvedValue([
      { organizationId: 'org-err' },
    ]);
    mockPollAndProcessInbound.mockRejectedValue(new Error('Storecove API down'));

    const req = new NextRequest('http://localhost/api/peppol/poll', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-err' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { polled: number; results: unknown[] };
    // Error is caught per-participant, result is null so not pushed
    expect(json.polled).toBe(0);
    expect(json.results).toHaveLength(0);
    // Error should be recorded on the connection
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          lastErrorMessage: 'Storecove API down',
        }),
      }),
    );
  });
});
