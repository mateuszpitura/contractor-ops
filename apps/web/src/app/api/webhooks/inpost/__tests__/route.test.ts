/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerifyInPostSignature, mockHandleInPostWebhook, mockPrisma } = vi.hoisted(() => {
  const mockVerifyInPostSignature = vi.fn();
  const mockHandleInPostWebhook = vi.fn();
  const mockPrisma = {
    courierConfig: {
      findMany: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
    },
  };
  return { mockVerifyInPostSignature, mockHandleInPostWebhook, mockPrisma };
});

vi.mock('@contractor-ops/api/services/courier/inpost-webhook-handler', () => ({
  verifyInPostSignature: mockVerifyInPostSignature,
  handleInPostWebhook: mockHandleInPostWebhook,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

import { POST } from '../route';

describe('POST /api/webhooks/inpost', () => {
  const validPayload = {
    shipment_id: 'ship-123',
    tracking_number: 'TRACK001',
    status: 'delivered',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.courierConfig.findMany.mockResolvedValue([
      { organizationId: 'org-1', configJson: { webhookSecret: 'secret-1' } },
    ]);
    mockVerifyInPostSignature.mockReturnValue(true);
    mockHandleInPostWebhook.mockResolvedValue(undefined);
  });

  it('processes a valid webhook and returns 200', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/inpost', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'x-inpost-signature': 'valid-sig' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);
    expect(mockHandleInPostWebhook).toHaveBeenCalledWith(mockPrisma, 'org-1', validPayload);
  });

  it('returns 401 when signature is invalid and shipment cannot be matched', async () => {
    mockVerifyInPostSignature.mockReturnValue(false);
    mockPrisma.shipment.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/webhooks/inpost', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'x-inpost-signature': 'bad-sig' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid signature');
    expect(mockHandleInPostWebhook).not.toHaveBeenCalled();
  });

  it('falls back to shipment lookup when signature does not match', async () => {
    mockVerifyInPostSignature.mockReturnValue(false);
    mockPrisma.shipment.findFirst.mockResolvedValue({ organizationId: 'org-fallback' });

    const req = new NextRequest('http://localhost/api/webhooks/inpost', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'x-inpost-signature': 'unknown-sig' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleInPostWebhook).toHaveBeenCalledWith(mockPrisma, 'org-fallback', validPayload);
  });

  it('returns 404 when no InPost courier configs exist', async () => {
    mockPrisma.courierConfig.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/webhooks/inpost', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Not configured');
  });
});
