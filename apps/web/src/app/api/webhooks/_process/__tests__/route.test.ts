/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAdapter,
  mockFindUnique,
  mockUpdate,
  mockIntegrationConnectionFindUnique,
  mockProcessResendWebhookDelivery,
} = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockIntegrationConnectionFindUnique: vi.fn(),
  mockProcessResendWebhookDelivery: vi.fn(async () => ({ processedCount: 0 })),
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/registry', () => ({
  getAdapter: mockGetAdapter,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    integrationConnection: {
      findUnique: mockIntegrationConnectionFindUnique,
    },
  },
}));

const { mockHandleSigningCompletion, mockProcessJiraWebhook } = vi.hoisted(() => ({
  mockHandleSigningCompletion: vi.fn(async () => undefined),
  mockProcessJiraWebhook: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/api/services/esign-orchestrator', () => ({
  handleSigningCompletion: mockHandleSigningCompletion,
}));

vi.mock('@contractor-ops/api/services/jira-webhook-handler', () => ({
  processJiraWebhook: mockProcessJiraWebhook,
}));

const { mockProcessLinearWebhook } = vi.hoisted(() => ({
  mockProcessLinearWebhook: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/api/services/linear-webhook-handler', () => ({
  processLinearWebhook: mockProcessLinearWebhook,
}));

vi.mock('@contractor-ops/api/services/resend-email-intake', () => ({
  processResendWebhookDelivery: (...args: unknown[]) => mockProcessResendWebhookDelivery(...args),
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/webhooks/_process', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/webhooks/_process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdapter.mockReturnValue(null);
    mockFindUnique.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({});
    mockIntegrationConnectionFindUnique.mockResolvedValue(null);
  });

  it('returns 400 when deliveryId or provider is missing', async () => {
    const res = await POST(postJson({ deliveryId: 'd1' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('Missing');
  });

  it('returns 404 when adapter has no handleWebhook', async () => {
    mockGetAdapter.mockReturnValue({ handleWebhook: undefined });

    const res = await POST(postJson({ deliveryId: 'd1', provider: 'stripe' }));
    expect(res.status).toBe(404);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when delivery record does not exist', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => undefined),
    });
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(postJson({ deliveryId: 'missing', provider: 'stripe' }));
    expect(res.status).toBe(404);
  });

  it('runs handleWebhook and marks delivery PROCESSED', async () => {
    const handleWebhook = vi.fn(async () => ({ ok: true }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-1',
      organizationId: 'org-1',
      integrationConnectionId: 'conn-1',
      payloadJson: { type: 'test' },
    });

    const res = await POST(postJson({ deliveryId: 'del-1', provider: 'stripe' }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { processed: boolean };
    expect(json.processed).toBe(true);

    expect(handleWebhook).toHaveBeenCalledWith({ type: 'test' }, 'org-1', 'conn-1');
    expect(mockProcessResendWebhookDelivery).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'del-1' },
      data: expect.objectContaining({
        deliveryStatus: 'PROCESSED',
      }),
    });
  });

  it('marks delivery FAILED when handleWebhook throws', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    mockFindUnique.mockResolvedValue({
      id: 'del-2',
      organizationId: 'org-1',
      integrationConnectionId: null,
      payloadJson: {},
    });

    const res = await POST(postJson({ deliveryId: 'del-2', provider: 'stripe' }));

    expect(res.status).toBe(500);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'del-2' },
      data: expect.objectContaining({
        deliveryStatus: 'FAILED',
        errorMessage: 'boom',
      }),
    });
  });

  it('dispatches to processJiraWebhook for jira provider', async () => {
    const handleWebhook = vi.fn(async () => ({ ok: true }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-jira-1',
      organizationId: 'org-jira',
      integrationConnectionId: 'conn-jira',
      payloadJson: { issue: { key: 'PROJ-1' } },
    });

    const res = await POST(postJson({ deliveryId: 'del-jira-1', provider: 'jira' }));

    expect(res.status).toBe(200);
    expect(mockProcessJiraWebhook).toHaveBeenCalledWith(
      expect.anything(),
      'org-jira',
      'conn-jira',
      { issue: { key: 'PROJ-1' } },
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'del-jira-1' },
      data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
    });
  });

  it('dispatches to handleSigningCompletion for docusign provider when completed', async () => {
    const handleWebhook = vi.fn(async () => ({
      envelopeId: 'env-123',
      completed: true,
    }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-ds-1',
      organizationId: 'org-ds',
      integrationConnectionId: 'conn-ds',
      payloadJson: { event: 'envelope-completed' },
    });

    const res = await POST(postJson({ deliveryId: 'del-ds-1', provider: 'docusign' }));

    expect(res.status).toBe(200);
    expect(mockHandleSigningCompletion).toHaveBeenCalledWith('env-123', 'conn-ds', 'DOCUSIGN');
  });

  it('dispatches to handleSigningCompletion for autenti provider when completed', async () => {
    const handleWebhook = vi.fn(async () => ({
      envelopeId: 'env-456',
      completed: true,
    }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-au-1',
      organizationId: 'org-au',
      integrationConnectionId: 'conn-au',
      payloadJson: { status: 'signed' },
    });

    const res = await POST(postJson({ deliveryId: 'del-au-1', provider: 'autenti' }));

    expect(res.status).toBe(200);
    expect(mockHandleSigningCompletion).toHaveBeenCalledWith('env-456', 'conn-au', 'AUTENTI');
  });

  it('backfills organizationId from IntegrationConnection when delivery org is empty', async () => {
    const handleWebhook = vi.fn(async () => ({ ok: true }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-backfill',
      organizationId: '',
      integrationConnectionId: 'ic-1',
      eventType: 'UNKNOWN',
      payloadJson: { type: 'test' },
    });
    mockIntegrationConnectionFindUnique.mockResolvedValue({
      organizationId: 'org-from-connection',
    });

    const res = await POST(postJson({ deliveryId: 'del-backfill', provider: 'stripe' }));

    expect(res.status).toBe(200);
    expect(mockIntegrationConnectionFindUnique).toHaveBeenCalledWith({
      where: { id: 'ic-1' },
      select: { organizationId: true },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'del-backfill' },
      data: { organizationId: 'org-from-connection' },
    });
    expect(handleWebhook).toHaveBeenCalledWith({ type: 'test' }, 'org-from-connection', 'ic-1');
  });

  it('calls processResendWebhookDelivery for resend provider', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => undefined),
    });
    mockFindUnique.mockResolvedValue({
      id: 'del-resend',
      organizationId: 'org-r',
      integrationConnectionId: null,
      eventType: 'email.received',
      payloadJson: { type: 'email.received', data: { email_id: 'e1' } },
    });

    const res = await POST(postJson({ deliveryId: 'del-resend', provider: 'resend' }));

    expect(res.status).toBe(200);
    expect(mockProcessResendWebhookDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org-r',
        eventType: 'email.received',
        payloadJson: { type: 'email.received', data: { email_id: 'e1' } },
      }),
    );
  });

  it('dispatches to processLinearWebhook for linear provider', async () => {
    const handleWebhook = vi.fn(async () => ({ ok: true }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-linear-1',
      organizationId: 'org-linear',
      integrationConnectionId: 'conn-linear',
      payloadJson: { action: 'update', type: 'Issue' },
    });

    const res = await POST(postJson({ deliveryId: 'del-linear-1', provider: 'linear' }));

    expect(res.status).toBe(200);
    expect(mockProcessLinearWebhook).toHaveBeenCalledWith(
      expect.anything(),
      'org-linear',
      'conn-linear',
      { action: 'update', type: 'Issue' },
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'del-linear-1' },
      data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
    });
  });

  it('does not call handleSigningCompletion for e-sign provider when not completed', async () => {
    const handleWebhook = vi.fn(async () => ({
      envelopeId: 'env-789',
      completed: false,
    }));

    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'del-ds-2',
      organizationId: 'org-ds',
      integrationConnectionId: 'conn-ds',
      payloadJson: { event: 'envelope-sent' },
    });

    const res = await POST(postJson({ deliveryId: 'del-ds-2', provider: 'docusign' }));

    expect(res.status).toBe(200);
    expect(mockHandleSigningCompletion).not.toHaveBeenCalled();
  });
});
