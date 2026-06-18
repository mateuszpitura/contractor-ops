/**
 * Per-job QStash retry-config contract for `enqueueJob`.
 *
 * Pins the *real* `JOB_CONFIG` retry counts to the wire by asserting what
 * `enqueueJob` hands to `publishJSON`. `JOB_CONFIG` is module-private, so
 * driving the production producer path is the only honest way to assert the
 * configured value (reading a private const would be a tautology).
 *
 * Focus: `peppol.outbound` retries = 5 (a Peppol transmission must survive a
 * transient ASP/transport blip; 3 was the old shared default). The other
 * Peppol topics (inbound/poll = 3) are pinned alongside so an accidental
 * blanket change to the registry trips here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPublishJSON } = vi.hoisted(() => ({
  mockPublishJSON: vi.fn(async () => ({ messageId: 'msg-test' })),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({ publishJSON: mockPublishJSON })),
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => ({ API_URL: 'https://api.example.test' })),
}));

import { enqueueJob } from '../queue.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockPublishJSON.mockResolvedValue({ messageId: 'msg-test' });
});

describe('enqueueJob retry config', () => {
  it('peppol.outbound enqueues with retries: 5 (real JOB_CONFIG value)', async () => {
    await enqueueJob('peppol.outbound', {
      organizationId: 'org-1',
      invoiceId: 'inv-1',
      receiverParticipantId: '0192:123456',
    });

    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    const request = mockPublishJSON.mock.calls[0]?.[0] as { url: string; retries: number };
    expect(request.retries).toBe(5);
    expect(request.url).toBe('https://api.example.test/peppol/outbound');
  });

  it('peppol.inbound / peppol.poll keep retries: 3 (outbound 5 is intentional, not a blanket bump)', async () => {
    await enqueueJob('peppol.inbound', { organizationId: 'org-1', transmissionId: 'tx-1' });
    await enqueueJob('peppol.poll', { organizationId: 'org-1' });

    const inbound = mockPublishJSON.mock.calls[0]?.[0] as { retries: number };
    const poll = mockPublishJSON.mock.calls[1]?.[0] as { retries: number };
    expect(inbound.retries).toBe(3);
    expect(poll.retries).toBe(3);
  });

  it('per-call opts.retries overrides the registry default without mutating it', async () => {
    await enqueueJob(
      'peppol.outbound',
      { organizationId: 'org-1', invoiceId: 'inv-1', receiverParticipantId: '0192:1' },
      { retries: 1 },
    );
    const overridden = mockPublishJSON.mock.calls[0]?.[0] as { retries: number };
    expect(overridden.retries).toBe(1);

    // A subsequent default enqueue still sees 5 — the override was per-call.
    await enqueueJob('peppol.outbound', {
      organizationId: 'org-1',
      invoiceId: 'inv-2',
      receiverParticipantId: '0192:2',
    });
    const second = mockPublishJSON.mock.calls[1]?.[0] as { retries: number };
    expect(second.retries).toBe(5);
  });
});
