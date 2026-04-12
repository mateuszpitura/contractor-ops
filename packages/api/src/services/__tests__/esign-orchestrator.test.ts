import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as E from '../../errors.js';
import { sendForSignature } from '../esign-orchestrator.js';
import { createPresignedDownloadUrl } from '../r2.js';

const { mockDocumentFindFirst, mockTx, mockTransaction, mockCreateSigningEnvelope } = vi.hoisted(
  () => {
    const mockCreateSigningEnvelope = vi.fn();

    const mockTx = {
      signingEnvelope: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      signingRecipient: { create: vi.fn() },
      signingEvent: { create: vi.fn() },
      contract: { update: vi.fn() },
      externalLink: { create: vi.fn() },
    };

    const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    );

    return {
      mockDocumentFindFirst: vi.fn(),
      mockTx,
      mockTransaction,
      mockCreateSigningEnvelope,
    };
  },
);

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    document: {
      findFirst: mockDocumentFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@contractor-ops/integrations/services/esign-service', () => ({
  createSigningEnvelope: (...args: unknown[]) => mockCreateSigningEnvelope(...args),
  getEmbeddedSigningUrl: vi.fn(),
  downloadSignedDocument: vi.fn(),
  voidSigningEnvelope: vi.fn(),
  resendSigningNotification: vi.fn(),
}));

vi.mock('../r2.js', () => ({
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  generateStorageKey: vi.fn(),
}));

describe('sendForSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPresignedDownloadUrl).mockResolvedValue('https://r2.example.com/signed');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      }),
    );

    mockDocumentFindFirst.mockResolvedValue({
      storageKey: 'org/doc.pdf',
      originalFileName: 'invoice.pdf',
      documentType: 'INVOICE',
    });

    mockCreateSigningEnvelope.mockResolvedValue({
      externalEnvelopeId: 'ext-env-1',
      status: 'SENT',
      signers: [
        {
          externalRecipientId: 'xr-1',
          email: 'signer@example.com',
          status: 'SENT',
        },
      ],
    });

    mockTx.signingEnvelope.create.mockResolvedValue({
      id: 'env-internal-1',
      recipients: [],
    });
    mockTx.signingEnvelope.findUniqueOrThrow.mockResolvedValue({
      id: 'env-internal-1',
      recipients: [],
    });
    mockTx.signingRecipient.create.mockResolvedValue({});
    mockTx.signingEvent.create.mockResolvedValue({});
    mockTx.contract.update.mockResolvedValue({});
    mockTx.externalLink.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws INTERNAL_SERVER_ERROR when presigned document fetch is not OK', async () => {
    vi.mocked(createPresignedDownloadUrl).mockResolvedValue('https://r2.bad/doc');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(
      sendForSignature({
        organizationId: 'org_1',
        userId: 'user_1',
        documentId: 'doc_1',
        connectionId: 'conn_1',
        provider: 'DOCUSIGN',
        signers: [
          {
            name: 'Signer',
            email: 'signer@example.com',
            role: 'signer',
            routingOrder: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: E.ESIGN_DOWNLOAD_FAILED,
    });
  });

  it('throws NOT_FOUND when document does not exist', async () => {
    mockDocumentFindFirst.mockResolvedValue(null);

    await expect(
      sendForSignature({
        organizationId: 'org_1',
        userId: 'user_1',
        documentId: 'doc_missing',
        connectionId: 'conn_1',
        provider: 'DOCUSIGN',
        signers: [
          {
            name: 'Signer',
            email: 'signer@example.com',
            role: 'signer',
            routingOrder: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: E.ESIGN_DOCUMENT_NOT_FOUND,
    });
  });

  it('creates envelope, recipients, events, external link, and returns envelope', async () => {
    const envelope = await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [
        {
          name: 'Signer',
          email: 'signer@example.com',
          role: 'signer',
          routingOrder: 1,
        },
      ],
    });

    expect(envelope.id).toBe('env-internal-1');
    expect(mockCreateSigningEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'DOCUSIGN',
        connectionId: 'conn_1',
        request: expect.objectContaining({
          documentName: 'invoice.pdf',
        }),
      }),
    );
    expect(mockTx.signingEnvelope.create).toHaveBeenCalled();
    expect(mockTx.signingRecipient.create).toHaveBeenCalledTimes(1);
    expect(mockTx.signingEvent.create).toHaveBeenCalledTimes(2);
    expect(mockTx.contract.update).not.toHaveBeenCalled();
    expect(mockTx.externalLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'DOCUMENT',
          entityId: 'doc_1',
          externalId: 'ext-env-1',
        }),
      }),
    );
  });

  it('updates contract to PENDING_SIGNATURE and links CONTRACT when contractId set', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      contractId: 'contract_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [
        {
          name: 'Signer',
          email: 'signer@example.com',
          role: 'signer',
          routingOrder: 1,
        },
      ],
    });

    expect(mockTx.contract.update).toHaveBeenCalledWith({
      where: { id: 'contract_1' },
      data: { status: 'PENDING_SIGNATURE' },
    });
    expect(mockTx.externalLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'CONTRACT',
          entityId: 'contract_1',
        }),
      }),
    );
  });
});
