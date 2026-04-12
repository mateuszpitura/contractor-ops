import { beforeEach, describe, expect, it, vi } from 'vitest';

const normalizeSigningEvent = vi.fn();

vi.mock('../esign-service.js', () => ({
  normalizeSigningEvent: (...args: any[]) => normalizeSigningEvent(...args),
}));

const mockSigningEnvelopeFindFirst = vi.fn();
const mockSigningEventFindFirst = vi.fn();
const mockTransaction = vi.fn();

const mockSigningEventCreate = vi.fn();
const mockSigningRecipientFindFirst = vi.fn();
const mockSigningRecipientUpdate = vi.fn();
const mockSigningEnvelopeUpdate = vi.fn();
const mockContractUpdate = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    signingEnvelope: {
      findFirst: (...args: any[]) => mockSigningEnvelopeFindFirst(...args),
    },
    signingEvent: {
      findFirst: (...args: any[]) => mockSigningEventFindFirst(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

import type { NormalizedSigningEvent } from '../../types/esign.js';
import { handleSigningWebhook } from '../esign-webhook-handler.js';

function baseEnvelope() {
  return {
    id: 'se-internal',
    externalEnvelopeId: 'ext-env-1',
    organizationId: 'org-1',
    contractId: 'contract-1',
  };
}

function baseNormalized(over: Partial<NormalizedSigningEvent> = {}) {
  return {
    externalEnvelopeId: 'ext-env-1',
    eventType: 'ENVELOPE_SENT' as const,
    description: 'unit test event',
    occurredAt: new Date('2026-04-04T12:00:00.000Z'),
    providerEventId: 'prov-evt-1',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSigningEnvelopeFindFirst.mockResolvedValue(baseEnvelope());
  mockSigningEventFindFirst.mockResolvedValue(null);
  mockTransaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
    const tx = {
      signingEvent: { create: mockSigningEventCreate },
      signingRecipient: {
        findFirst: mockSigningRecipientFindFirst,
        update: mockSigningRecipientUpdate,
      },
      signingEnvelope: { update: mockSigningEnvelopeUpdate },
      contract: { update: mockContractUpdate },
    };
    await fn(tx as never);
  });
});

describe('handleSigningWebhook', () => {
  it('creates SigningEvent record inside transaction', async () => {
    normalizeSigningEvent.mockReturnValue(baseNormalized());

    await handleSigningWebhook({
      provider: 'DOCUSIGN',
      payload: { mock: true },
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });

    expect(normalizeSigningEvent).toHaveBeenCalledWith('DOCUSIGN', { mock: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockSigningEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        signingEnvelopeId: 'se-internal',
        eventType: 'ENVELOPE_SENT',
        providerEventId: 'prov-evt-1',
      }),
    });
  });

  it('returns early without transaction when providerEventId is duplicate', async () => {
    normalizeSigningEvent.mockReturnValue(baseNormalized({ providerEventId: 'dup-1' }));
    mockSigningEventFindFirst.mockResolvedValue({ id: 'existing-event' });

    const out = await handleSigningWebhook({
      provider: 'AUTENTI',
      payload: {},
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });

    expect(out).toEqual({ envelopeId: 'se-internal', completed: false });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('updates SigningRecipient on RECIPIENT_SIGNED', async () => {
    normalizeSigningEvent.mockReturnValue(
      baseNormalized({
        eventType: 'RECIPIENT_SIGNED',
        recipientEmail: 'signer@example.com',
        recipientStatus: 'SIGNED',
      }),
    );
    mockSigningRecipientFindFirst.mockResolvedValue({
      id: 'rec-1',
      email: 'signer@example.com',
    });

    await handleSigningWebhook({
      provider: 'DOCUSIGN',
      payload: {},
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });

    expect(mockSigningRecipientUpdate).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: expect.objectContaining({
        status: 'SIGNED',
        signedAt: expect.any(Date),
      }),
    });
  });

  it('updates SigningEnvelope on ENVELOPE_COMPLETED and returns completed true (orchestrator should fetch PDF)', async () => {
    normalizeSigningEvent.mockReturnValue(
      baseNormalized({
        eventType: 'ENVELOPE_COMPLETED',
        envelopeStatus: 'COMPLETED',
      }),
    );

    const out = await handleSigningWebhook({
      provider: 'DOCUSIGN',
      payload: {},
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });

    expect(mockSigningEnvelopeUpdate).toHaveBeenCalledWith({
      where: { id: 'se-internal' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      }),
    });
    expect(mockContractUpdate).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        signedAt: expect.any(Date),
      }),
    });
    expect(out.completed).toBe(true);
    expect(out.envelopeId).toBe('se-internal');
  });

  it('sets contract to SIGNATURE_DECLINED when envelopeStatus is DECLINED', async () => {
    normalizeSigningEvent.mockReturnValue(
      baseNormalized({
        eventType: 'RECIPIENT_DECLINED',
        envelopeStatus: 'DECLINED',
        recipientEmail: 'signer@example.com',
        recipientStatus: 'DECLINED',
      }),
    );
    mockSigningRecipientFindFirst.mockResolvedValue({ id: 'rec-1' });

    await handleSigningWebhook({
      provider: 'DOCUSIGN',
      payload: {},
      organizationId: 'org-1',
      connectionId: 'conn-1',
    });

    expect(mockContractUpdate).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { status: 'SIGNATURE_DECLINED' },
    });
  });

  it('throws when SigningEnvelope is missing', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);
    normalizeSigningEvent.mockReturnValue(baseNormalized({ externalEnvelopeId: 'unknown' }));

    await expect(
      handleSigningWebhook({
        provider: 'DOCUSIGN',
        payload: {},
        organizationId: 'org-1',
        connectionId: 'conn-1',
      }),
    ).rejects.toThrow(/SigningEnvelope not found/);
  });
});
