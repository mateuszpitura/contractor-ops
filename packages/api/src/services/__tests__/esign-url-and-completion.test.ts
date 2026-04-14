import {
  downloadSignedDocument,
  getEmbeddedSigningUrl,
  resendSigningNotification,
  voidSigningEnvelope,
} from '@contractor-ops/integrations/services/esign-service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as E from '../../errors.js';
import {
  getSigningUrl,
  handleSigningCompletion,
  resendToRecipient,
  voidEnvelope,
} from '../esign-orchestrator.js';
import { createPresignedUploadUrl } from '../r2.js';

const {
  mockSigningEnvelopeFindFirst,
  mockDocumentFindUnique,
  mockSigningEventCreate,
  mockSigningEnvelopeUpdate,
  mockContractFindUnique,
  mockContractUpdate,
  mockTx,
  mockTransaction,
} = vi.hoisted(() => {
  const mockTx = {
    document: { create: vi.fn() },
    documentLink: { create: vi.fn() },
    signingEvent: { create: vi.fn() },
    signingEnvelope: { update: vi.fn() },
    contract: { findUnique: vi.fn(), update: vi.fn() },
  };
  const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx),
  );
  return {
    mockSigningEnvelopeFindFirst: vi.fn(),
    mockDocumentFindUnique: vi.fn(),
    mockSigningEventCreate: vi.fn().mockResolvedValue({}),
    mockSigningEnvelopeUpdate: vi.fn().mockResolvedValue({}),
    mockContractFindUnique: vi.fn(),
    mockContractUpdate: vi.fn().mockResolvedValue({}),
    mockTx,
    mockTransaction,
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    signingEnvelope: {
      findFirst: mockSigningEnvelopeFindFirst,
    },
    document: {
      findUnique: mockDocumentFindUnique,
    },
    signingEvent: {
      create: mockSigningEventCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@contractor-ops/integrations/services/esign-service', () => ({
  createSigningEnvelope: vi.fn(),
  getEmbeddedSigningUrl: vi.fn(),
  downloadSignedDocument: vi.fn(),
  voidSigningEnvelope: vi.fn(),
  resendSigningNotification: vi.fn(),
}));

vi.mock('../r2.js', () => ({
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  generateStorageKey: vi.fn(() => 'orgs/o1/esign/key.pdf'),
}));

describe('getSigningUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NOT_FOUND when envelope missing', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);
    await expect(
      getSigningUrl({
        organizationId: 'o1',
        envelopeId: 'e-missing',
        recipientEmail: 'a@b.com',
        returnUrl: 'https://app/cb',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  });

  it('throws PRECONDITION_FAILED when externalEnvelopeId missing', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: null,
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
    });
    await expect(
      getSigningUrl({
        organizationId: 'o1',
        envelopeId: 'e1',
        recipientEmail: 'a@b.com',
        returnUrl: 'https://app/cb',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  });

  it('returns embedded false when provider has no embedded URL', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'AUTENTI',
      integrationConnectionId: 'c1',
    });
    vi.mocked(getEmbeddedSigningUrl).mockResolvedValue(null);

    const result = await getSigningUrl({
      organizationId: 'o1',
      envelopeId: 'e1',
      recipientEmail: 'a@b.com',
      returnUrl: 'https://app/cb',
    });

    expect(result).toEqual({ embedded: false, redirectUrl: null });
  });

  it('returns embedded URL when provider supports it', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
    });
    const exp = new Date('2099-01-01');
    vi.mocked(getEmbeddedSigningUrl).mockResolvedValue({
      url: 'https://sign.example/view',
      expiresAt: exp,
    });

    const result = await getSigningUrl({
      organizationId: 'o1',
      envelopeId: 'e1',
      recipientEmail: 'a@b.com',
      returnUrl: 'https://app/cb',
    });

    expect(result).toEqual({
      embedded: true,
      url: 'https://sign.example/view',
      expiresAt: exp,
    });
  });
});

describe('handleSigningCompletion', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.document.create.mockResolvedValue({ id: 'doc-signed-1' });
    mockTx.documentLink.create.mockResolvedValue({});
    mockTx.signingEvent.create.mockResolvedValue({});
    mockDocumentFindUnique.mockResolvedValue({ documentType: 'CONTRACT' });
    vi.mocked(downloadSignedDocument).mockResolvedValue({
      documentBase64: Buffer.from('%PDF-1 signed').toString('base64'),
      fileName: 'contract-signed.pdf',
      mimeType: 'application/pdf',
    });
    vi.mocked(createPresignedUploadUrl).mockResolvedValue('https://r2.example/upload');
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when envelope not found', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);
    await expect(handleSigningCompletion('e1', 'c1', 'DOCUSIGN')).rejects.toThrow(
      /not found or missing external ID/,
    );
  });

  it('downloads signed doc, uploads to R2, creates document and link', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: 'contract-1',
      documentId: 'orig-doc',
      recipients: [],
    });

    const doc = await handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN');

    expect(doc.id).toBe('doc-signed-1');
    expect(downloadSignedDocument).toHaveBeenCalledWith({
      provider: 'DOCUSIGN',
      connectionId: 'c1',
      envelopeId: 'ext-out-1',
    });
    expect(createPresignedUploadUrl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://r2.example/upload',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockTx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'o1',
          source: 'ESIGN',
          documentType: 'CONTRACT',
        }),
      }),
    );
    expect(mockTx.documentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'CONTRACT',
          entityId: 'contract-1',
          linkRole: 'SIGNED_COPY',
        }),
      }),
    );
    expect(mockTx.signingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'SIGNED_PDF_SAVED' }),
      }),
    );
  });

  it('throws when R2 upload fails', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: null,
      documentId: null,
      recipients: [],
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN')).rejects.toThrow(
      /Failed to upload signed PDF to R2/,
    );
  });

  it('skips documentLink creation when contractId is null', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: null,
      documentId: 'orig-doc',
      recipients: [],
    });

    await handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN');

    expect(mockTx.documentLink.create).not.toHaveBeenCalled();
    expect(mockTx.document.create).toHaveBeenCalled();
    expect(mockTx.signingEvent.create).toHaveBeenCalled();
  });

  it('defaults documentType to OTHER when original document not found', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: null,
      documentId: 'doc-gone',
      recipients: [],
    });
    mockDocumentFindUnique.mockResolvedValue(null);

    await handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN');

    expect(mockTx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: 'OTHER',
        }),
      }),
    );
  });

  it('defaults documentType to OTHER when documentId is null on envelope', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: null,
      documentId: null,
      recipients: [],
    });

    await handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN');

    expect(mockTx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: 'OTHER',
        }),
      }),
    );
  });

  it('uses fallback fileName when provider returns none', async () => {
    vi.mocked(downloadSignedDocument).mockResolvedValue({
      documentBase64: Buffer.from('%PDF-1 signed').toString('base64'),
      fileName: '',
      mimeType: 'application/pdf',
    });
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'env-int-1',
      externalEnvelopeId: 'ext-out-1',
      organizationId: 'o1',
      contractId: null,
      documentId: null,
      recipients: [],
    });

    await handleSigningCompletion('env-int-1', 'c1', 'DOCUSIGN');

    expect(mockTx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalFileName: 'signed-document.pdf',
        }),
      }),
    );
  });
});

// ===========================================================================
// voidEnvelope
// ===========================================================================

describe('voidEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.signingEnvelope.update.mockResolvedValue({});
    mockTx.signingEvent.create.mockResolvedValue({});
    mockTx.contract.findUnique.mockResolvedValue(null);
    mockTx.contract.update.mockResolvedValue({});
  });

  it('throws NOT_FOUND when envelope missing', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);

    await expect(
      voidEnvelope({
        organizationId: 'o1',
        envelopeId: 'e-missing',
        userId: 'u1',
        reason: 'wrong doc',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  });

  it('throws PRECONDITION_FAILED when externalEnvelopeId is null', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: null,
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: null,
    });

    await expect(
      voidEnvelope({
        organizationId: 'o1',
        envelopeId: 'e1',
        userId: 'u1',
        reason: 'wrong doc',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  });

  it('calls voidProviderEnvelope and updates envelope status to VOIDED', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: null,
    });

    await voidEnvelope({
      organizationId: 'o1',
      envelopeId: 'e1',
      userId: 'u1',
      reason: 'wrong document attached',
    });

    expect(voidSigningEnvelope).toHaveBeenCalledWith({
      provider: 'DOCUSIGN',
      connectionId: 'c1',
      envelopeId: 'ext-1',
      reason: 'wrong document attached',
    });
    expect(mockTx.signingEnvelope.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({
          status: 'VOIDED',
          voidReason: 'wrong document attached',
          voidedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('creates ENVELOPE_VOIDED event with reason', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: null,
    });

    await voidEnvelope({
      organizationId: 'o1',
      envelopeId: 'e1',
      userId: 'u1',
      reason: 'mistake',
    });

    expect(mockTx.signingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'ENVELOPE_VOIDED',
          description: 'Envelope voided: mistake',
          actorName: 'u1',
        }),
      }),
    );
  });

  it('reverts contract to DRAFT when contract is PENDING_SIGNATURE', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: 'contract-1',
    });
    mockTx.contract.findUnique.mockResolvedValue({ status: 'PENDING_SIGNATURE' });

    await voidEnvelope({
      organizationId: 'o1',
      envelopeId: 'e1',
      userId: 'u1',
      reason: 'cancel',
    });

    expect(mockTx.contract.update).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { status: 'DRAFT' },
    });
  });

  it('does not revert contract when contract status is not PENDING_SIGNATURE', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: 'contract-1',
    });
    mockTx.contract.findUnique.mockResolvedValue({ status: 'ACTIVE' });

    await voidEnvelope({
      organizationId: 'o1',
      envelopeId: 'e1',
      userId: 'u1',
      reason: 'cancel',
    });

    expect(mockTx.contract.update).not.toHaveBeenCalled();
  });

  it('skips contract revert when no contractId on envelope', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
      contractId: null,
    });

    await voidEnvelope({
      organizationId: 'o1',
      envelopeId: 'e1',
      userId: 'u1',
      reason: 'cancel',
    });

    expect(mockTx.contract.findUnique).not.toHaveBeenCalled();
    expect(mockTx.contract.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// resendToRecipient
// ===========================================================================

describe('resendToRecipient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSigningEventCreate.mockResolvedValue({});
  });

  it('throws NOT_FOUND when envelope missing', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);

    await expect(
      resendToRecipient({
        organizationId: 'o1',
        envelopeId: 'e-missing',
        recipientEmail: 'a@b.com',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  });

  it('throws PRECONDITION_FAILED when externalEnvelopeId is null', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: null,
      provider: 'DOCUSIGN',
      integrationConnectionId: 'c1',
    });

    await expect(
      resendToRecipient({
        organizationId: 'o1',
        envelopeId: 'e1',
        recipientEmail: 'a@b.com',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  });

  it('calls resendSigningNotification and creates ENVELOPE_SENT event', async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: 'e1',
      externalEnvelopeId: 'ext-1',
      provider: 'AUTENTI',
      integrationConnectionId: 'c1',
    });

    await resendToRecipient({
      organizationId: 'o1',
      envelopeId: 'e1',
      recipientEmail: 'signer@co.com',
    });

    expect(resendSigningNotification).toHaveBeenCalledWith({
      provider: 'AUTENTI',
      connectionId: 'c1',
      envelopeId: 'ext-1',
      recipientEmail: 'signer@co.com',
    });
    expect(mockSigningEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'o1',
          signingEnvelopeId: 'e1',
          eventType: 'ENVELOPE_SENT',
          description: 'Resent to signer@co.com',
        }),
      }),
    );
  });
});
