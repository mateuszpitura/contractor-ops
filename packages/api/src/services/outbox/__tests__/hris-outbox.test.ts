import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { mockResolveTarget, mockEvaluate, mockGetAdapter, mockLoadHeavy, mockPush, mockAudit } =
  vi.hoisted(() => ({
    mockResolveTarget: vi.fn(),
    mockEvaluate: vi.fn(),
    mockGetAdapter: vi.fn(),
    mockLoadHeavy: vi.fn(async () => undefined),
    mockPush: vi.fn(async () => undefined),
    mockAudit: vi.fn(async () => undefined),
  }));

vi.mock('@contractor-ops/feature-flags', () => ({ evaluate: mockEvaluate }));
vi.mock('@contractor-ops/integrations', () => ({
  getAdapter: mockGetAdapter,
  loadHeavyAdapters: mockLoadHeavy,
}));
vi.mock('../../audit-writer', () => ({ writeAuditLog: mockAudit }));
vi.mock('../hris-push-target', () => ({ resolveHrisPushTarget: mockResolveTarget }));

import { dispatchOutboxEvent } from '../handlers';

const HRIS_TYPES = [
  'hris.invoice-paid.push',
  'hris.payment-status.push',
  'hris.classification-outcome.push',
] as const;

const payloads: Record<(typeof HRIS_TYPES)[number], Record<string, unknown>> = {
  'hris.invoice-paid.push': {
    kind: 'invoice-paid',
    workerId: 'w1',
    invoiceId: 'inv1',
    paidAt: '2026-07-01T00:00:00Z',
    amount: '100.00',
    currency: 'EUR',
  },
  'hris.payment-status.push': {
    kind: 'payment-status',
    workerId: 'w1',
    paymentId: 'pay1',
    status: 'PAID',
    occurredAt: '2026-07-01T00:00:00Z',
  },
  'hris.classification-outcome.push': {
    kind: 'classification-outcome',
    workerId: 'w1',
    classificationId: 'cls1',
    outcome: 'EMPLOYEE',
    decidedAt: '2026-07-01T00:00:00Z',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdapter.mockReturnValue({ pushEmployeeEvent: mockPush });
  mockEvaluate.mockReturnValue({ enabled: true, reason: 'enabled' });
  mockResolveTarget.mockResolvedValue({
    connection: { provider: 'PERSONIO' },
    provider: 'PERSONIO',
    region: 'EU',
  });
});

describe('HRIS push outbox handlers', () => {
  it.each(
    HRIS_TYPES,
  )('dispatches %s to the connected adapter with outboxEventId idempotency', async type => {
    await dispatchOutboxEvent({
      id: 'oxe_123',
      organizationId: 'org-a',
      eventType: type,
      payload: payloads[type],
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0]?.[1] as { idempotencyKey?: string };
    expect(arg.idempotencyKey).toBe('oxe_123');
  });

  it('no-ops (not an error) when no HRIS connection exists', async () => {
    mockResolveTarget.mockResolvedValueOnce(null);
    await expect(
      dispatchOutboxEvent({
        id: 'oxe_1',
        organizationId: 'org-a',
        eventType: 'hris.invoice-paid.push',
        payload: payloads['hris.invoice-paid.push'],
      }),
    ).resolves.toBeUndefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('no-ops when the integration.*-sync flag is dark', async () => {
    mockEvaluate.mockReturnValueOnce({ enabled: false, reason: 'default' });
    await dispatchOutboxEvent({
      id: 'oxe_2',
      organizationId: 'org-a',
      eventType: 'hris.payment-status.push',
      payload: payloads['hris.payment-status.push'],
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
