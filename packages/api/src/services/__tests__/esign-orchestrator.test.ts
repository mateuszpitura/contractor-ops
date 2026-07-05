import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as E from '../../errors';
import { handleSigningCompletion, sendForSignature } from '../esign-orchestrator';
import { createPresignedDownloadUrl } from '../r2';

const {
  mockDocumentFindFirst,
  mockDocumentFindUnique,
  mockDocumentLinkFindFirst,
  mockTx,
  mockTransaction,
  mockCreateSigningEnvelope,
  mockDownloadSignedDocument,
  mockCreatePresignedUploadUrl,
  mockGenerateStorageKey,
  mockIntentFindUnique,
  mockIntentCreate,
  mockIntentUpdate,
  mockSigningEnvelopeFindUnique,
  mockSigningEnvelopeFindFirst,
  mockSigningEventFindFirst,
} = vi.hoisted(() => {
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
    document: { create: vi.fn() },
    documentLink: { create: vi.fn() },
  };

  const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

  return {
    mockDocumentFindFirst: vi.fn(),
    mockDocumentFindUnique: vi.fn(),
    mockDocumentLinkFindFirst: vi.fn(),
    mockTx,
    mockTransaction,
    mockCreateSigningEnvelope,
    mockDownloadSignedDocument: vi.fn(),
    mockCreatePresignedUploadUrl: vi.fn(),
    mockGenerateStorageKey: vi.fn(),
    mockIntentFindUnique: vi.fn(),
    mockIntentCreate: vi.fn(),
    mockIntentUpdate: vi.fn(),
    mockSigningEnvelopeFindUnique: vi.fn(),
    mockSigningEnvelopeFindFirst: vi.fn(),
    mockSigningEventFindFirst: vi.fn(),
  };
});

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    document: {
      findFirst: mockDocumentFindFirst,
      findUnique: mockDocumentFindUnique,
    },
    documentLink: {
      findFirst: mockDocumentLinkFindFirst,
    },
    esignEnvelopeIntent: {
      findUnique: mockIntentFindUnique,
      create: mockIntentCreate,
      update: mockIntentUpdate,
    },
    signingEnvelope: {
      findUnique: mockSigningEnvelopeFindUnique,
      findFirst: mockSigningEnvelopeFindFirst,
    },
    signingEvent: {
      findFirst: mockSigningEventFindFirst,
    },
    $transaction: mockTransaction,
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

vi.mock('@contractor-ops/integrations/services/esign-service', () => ({
  createSigningEnvelope: mockCreateSigningEnvelope,
  getEmbeddedSigningUrl: vi.fn(),
  downloadSignedDocument: mockDownloadSignedDocument,
  voidSigningEnvelope: vi.fn(),
  resendSigningNotification: vi.fn(),
}));

vi.mock('../r2', () => ({
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: mockCreatePresignedUploadUrl,
  generateStorageKey: mockGenerateStorageKey,
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

    // Default: no prior intent row (fresh send path).
    mockIntentFindUnique.mockResolvedValue(null);
    mockIntentCreate.mockResolvedValue({ id: 'intent-1' });
    mockIntentUpdate.mockResolvedValue({});
    mockSigningEnvelopeFindUnique.mockResolvedValue(null);

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

  it('creates recipients with correct role mapping (countersigner -> COUNTERSIGNER)', async () => {
    await sendForSignature({
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
        {
          name: 'Counter',
          email: 'counter@example.com',
          role: 'countersigner',
          routingOrder: 2,
        },
      ],
    });

    expect(mockTx.signingRecipient.create).toHaveBeenCalledTimes(2);
    expect(mockTx.signingRecipient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'signer@example.com',
          role: 'SIGNER',
        }),
      }),
    );
    expect(mockTx.signingRecipient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'counter@example.com',
          role: 'COUNTERSIGNER',
        }),
      }),
    );
  });

  it('passes custom message, expiresInDays, and reminderIntervalDays to provider', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'AUTENTI',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
      message: 'Please sign this document',
      expiresInDays: 30,
      reminderIntervalDays: 7,
    });

    expect(mockCreateSigningEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'AUTENTI',
        request: expect.objectContaining({
          message: 'Please sign this document',
          expiresInDays: 30,
          reminderIntervalDays: 7,
        }),
      }),
    );
    expect(mockTx.signingEnvelope.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'Please sign this document',
          reminderIntervalDays: 7,
        }),
      }),
    );
  });

  it('uses default expiresInDays of 14 when not provided', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
    });

    expect(mockCreateSigningEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          expiresInDays: 14,
        }),
      }),
    );
  });

  it('handles signer with no matching externalRecipientId gracefully', async () => {
    mockCreateSigningEnvelope.mockResolvedValue({
      externalEnvelopeId: 'ext-env-1',
      status: 'SENT',
      signers: [], // no matching signers returned
    });

    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
    });

    expect(mockTx.signingRecipient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalRecipientId: null,
        }),
      }),
    );
  });

  it('creates ENVELOPE_SENT event with first signer by routingOrder', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [
        { name: 'Second', email: 'second@e.com', role: 'countersigner', routingOrder: 2 },
        { name: 'First', email: 'first@e.com', role: 'signer', routingOrder: 1 },
      ],
    });

    const sentEventCall = mockTx.signingEvent.create.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { eventType: string } }).data.eventType === 'ENVELOPE_SENT',
    );
    expect(sentEventCall).toBeDefined();
    expect(sentEventCall[0].data.description).toContain('First');
  });

  it('sets externalType to DOCUSIGN_ENVELOPE for DocuSign provider', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'DOCUSIGN',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
    });

    expect(mockTx.externalLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalType: 'DOCUSIGN_ENVELOPE',
        }),
      }),
    );
  });

  it('sets externalType to AUTENTI_ENVELOPE for Autenti provider', async () => {
    await sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'AUTENTI',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
    });

    expect(mockTx.externalLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalType: 'AUTENTI_ENVELOPE',
        }),
      }),
    );
  });

  const autentiSend = () =>
    sendForSignature({
      organizationId: 'org_1',
      userId: 'user_1',
      documentId: 'doc_1',
      connectionId: 'conn_1',
      provider: 'AUTENTI',
      signers: [{ name: 'S', email: 's@e.com', role: 'signer', routingOrder: 1 }],
    });

  it('claims an intent row before calling the provider (Autenti)', async () => {
    await autentiSend();

    expect(mockIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          documentId: 'doc_1',
          provider: 'AUTENTI',
          integrationConnectionId: 'conn_1',
          signerSetHash: expect.any(String),
        }),
      }),
    );
    // The provider process id is stamped back onto the intent row before the tx.
    expect(mockIntentUpdate).toHaveBeenCalledWith({
      where: { id: 'intent-1' },
      data: { externalEnvelopeId: 'ext-env-1' },
    });
  });

  it('reuses the existing envelope on a duplicate send — one provider process', async () => {
    // First send creates the provider process (fresh path).
    await autentiSend();
    expect(mockCreateSigningEnvelope).toHaveBeenCalledTimes(1);

    // Second send: intent row now carries the provider id and a persisted
    // envelope exists → short-circuit, no second provider create.
    mockIntentFindUnique.mockResolvedValue({ id: 'intent-1', externalEnvelopeId: 'ext-env-1' });
    mockSigningEnvelopeFindUnique.mockResolvedValue({ id: 'env-internal-1', recipients: [] });

    const reused = await autentiSend();

    expect(reused.id).toBe('env-internal-1');
    expect(mockCreateSigningEnvelope).toHaveBeenCalledTimes(1);
    expect(mockSigningEnvelopeFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_externalEnvelopeId: { provider: 'AUTENTI', externalEnvelopeId: 'ext-env-1' },
        },
      }),
    );
  });

  it('retry after a rolled-back tx reuses the process instead of duplicating it', async () => {
    // First attempt: provider process created + intent stamped, then the local
    // transaction rolls back.
    mockTransaction.mockRejectedValueOnce(new Error('tx rolled back'));
    await expect(autentiSend()).rejects.toThrow('tx rolled back');
    expect(mockCreateSigningEnvelope).toHaveBeenCalledTimes(1);
    expect(mockIntentUpdate).toHaveBeenCalledWith({
      where: { id: 'intent-1' },
      data: { externalEnvelopeId: 'ext-env-1' },
    });

    // Retry: intent row carries the provider id but no envelope was persisted
    // (tx rolled back) → re-drive local persistence, no second provider create.
    mockIntentFindUnique.mockResolvedValue({ id: 'intent-1', externalEnvelopeId: 'ext-env-1' });
    mockSigningEnvelopeFindUnique.mockResolvedValue(null);

    const envelope = await autentiSend();

    expect(envelope.id).toBe('env-internal-1');
    expect(mockCreateSigningEnvelope).toHaveBeenCalledTimes(1);
    expect(mockTx.signingEnvelope.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalEnvelopeId: 'ext-env-1' }),
      }),
    );
  });

  it('resolves the existing envelope when a concurrent create wins (P2002)', async () => {
    // No intent on first read; our create loses the race with a P2002; the
    // winner already recorded a provider id + persisted envelope.
    mockIntentFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'intent-1', externalEnvelopeId: 'ext-env-1' });
    mockIntentCreate.mockRejectedValue({ code: 'P2002' });
    mockSigningEnvelopeFindUnique.mockResolvedValue({ id: 'env-internal-1', recipients: [] });

    const envelope = await autentiSend();

    expect(envelope.id).toBe('env-internal-1');
    expect(mockCreateSigningEnvelope).not.toHaveBeenCalled();
  });

  it('refuses to create a duplicate when the concurrent winner is mid-flight (P2002, no external id)', async () => {
    mockIntentFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'intent-1', externalEnvelopeId: null });
    mockIntentCreate.mockRejectedValue({ code: 'P2002' });

    await expect(autentiSend()).rejects.toMatchObject({
      code: 'CONFLICT',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
    expect(mockCreateSigningEnvelope).not.toHaveBeenCalled();
  });

  it('throws CONFLICT on a pre-existing claimed-but-unstamped intent (prior crash) — no second provider create', async () => {
    // The intent row was claimed by an earlier attempt that crashed after the
    // provider create but before stamping externalEnvelopeId. A retry must NOT
    // re-issue the provider create (which would duplicate the process) — it fails
    // closed for manual reconcile.
    mockIntentFindUnique.mockResolvedValue({ id: 'intent-1', externalEnvelopeId: null });

    await expect(autentiSend()).rejects.toMatchObject({
      code: 'CONFLICT',
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
    expect(mockCreateSigningEnvelope).not.toHaveBeenCalled();
    expect(mockIntentCreate).not.toHaveBeenCalled();
  });
});

describe('handleSigningCompletion', () => {
  const baseEnvelope = {
    id: 'env-internal-1',
    externalEnvelopeId: 'ext-env-1',
    organizationId: 'org_1',
    contractId: 'contract_1',
    documentId: 'doc_1',
    recipients: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    mockSigningEnvelopeFindFirst.mockResolvedValue(baseEnvelope);
    // Fast-path check: no SIGNED_PDF_SAVED yet → proceed to download + persist.
    mockSigningEventFindFirst.mockResolvedValue(null);
    mockDownloadSignedDocument.mockResolvedValue({
      documentBase64: Buffer.from('signed-pdf-bytes').toString('base64'),
      fileName: 'signed.pdf',
      mimeType: 'application/pdf',
    });
    mockCreatePresignedUploadUrl.mockResolvedValue('https://r2.example.com/upload');
    mockGenerateStorageKey.mockReturnValue('org_1/esign-env-internal-1/signed.pdf');
    mockDocumentFindUnique.mockResolvedValue({ documentType: 'CONTRACT' });

    mockTx.document.create.mockResolvedValue({ id: 'signed-doc-1' });
    mockTx.documentLink.create.mockResolvedValue({});
    mockTx.signingEvent.create.mockResolvedValue({});

    // The winner's persisted signed Document, resolvable via its SIGNED_COPY link.
    mockDocumentLinkFindFirst.mockResolvedValue({ document: { id: 'signed-doc-1' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the signed Document + SIGNED_PDF_SAVED event and returns the Document', async () => {
    const doc = await handleSigningCompletion('env-internal-1', 'conn_1', 'DOCUSIGN');

    expect(doc?.id).toBe('signed-doc-1');
    expect(mockTx.document.create).toHaveBeenCalledTimes(1);
    expect(mockTx.documentLink.create).toHaveBeenCalledTimes(1);
    const savedEvent = mockTx.signingEvent.create.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { eventType: string } }).data.eventType === 'SIGNED_PDF_SAVED',
    );
    expect(savedEvent).toBeDefined();
  });

  it('concurrent double-delivery: the loser catches the SIGNED_PDF_SAVED P2002 and returns the winner Document (no duplicate)', async () => {
    // Both deliveries pass the fast-path check, but the partial unique lets only
    // one SIGNED_PDF_SAVED event commit. Simulate the loser: its terminal event
    // insert raises P2002, rolling back the whole transaction (duplicate Document
    // + link included).
    mockTx.signingEvent.create.mockRejectedValueOnce({ code: 'P2002' });

    const doc = await handleSigningCompletion('env-internal-1', 'conn_1', 'DOCUSIGN');

    // Idempotent no-op: returns the winner's already-persisted signed Document,
    // resolved via the SIGNED_COPY DocumentLink — never a duplicate.
    expect(doc?.id).toBe('signed-doc-1');
    expect(mockDocumentLinkFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityType: 'CONTRACT',
          entityId: 'contract_1',
          linkRole: 'SIGNED_COPY',
        }),
      }),
    );
  });

  it('redelivered completed webhook: returns the existing signed Document without re-downloading', async () => {
    mockSigningEventFindFirst.mockResolvedValue({ id: 'evt-saved' });

    const doc = await handleSigningCompletion('env-internal-1', 'conn_1', 'DOCUSIGN');

    expect(doc?.id).toBe('signed-doc-1');
    expect(mockDownloadSignedDocument).not.toHaveBeenCalled();
    expect(mockTx.document.create).not.toHaveBeenCalled();
  });

  it('rethrows a non-P2002 transaction failure instead of masking it as idempotent', async () => {
    mockTx.signingEvent.create.mockRejectedValueOnce(new Error('db exploded'));

    await expect(handleSigningCompletion('env-internal-1', 'conn_1', 'DOCUSIGN')).rejects.toThrow(
      'db exploded',
    );
    expect(mockDocumentLinkFindFirst).not.toHaveBeenCalled();
  });
});
