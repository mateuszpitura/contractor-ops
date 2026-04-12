import {
  downloadSignedDocument,
  getEmbeddedSigningUrl,
} from "@contractor-ops/integrations/services/esign-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "../../errors.js";
import { getSigningUrl, handleSigningCompletion } from "../esign-orchestrator.js";
import { createPresignedUploadUrl, generateStorageKey } from "../r2.js";

const { mockSigningEnvelopeFindFirst, mockDocumentFindUnique, mockTx, mockTransaction } =
  vi.hoisted(() => {
    const mockTx = {
      document: { create: vi.fn() },
      documentLink: { create: vi.fn() },
      signingEvent: { create: vi.fn() },
    };
    const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    );
    return {
      mockSigningEnvelopeFindFirst: vi.fn(),
      mockDocumentFindUnique: vi.fn(),
      mockTx,
      mockTransaction,
    };
  });

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    signingEnvelope: {
      findFirst: mockSigningEnvelopeFindFirst,
    },
    document: {
      findUnique: mockDocumentFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@contractor-ops/integrations/services/esign-service", () => ({
  createSigningEnvelope: vi.fn(),
  getEmbeddedSigningUrl: vi.fn(),
  downloadSignedDocument: vi.fn(),
  voidSigningEnvelope: vi.fn(),
  resendSigningNotification: vi.fn(),
}));

vi.mock("../r2.js", () => ({
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  generateStorageKey: vi.fn(() => "orgs/o1/esign/key.pdf"),
}));

describe("getSigningUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when envelope missing", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);
    await expect(
      getSigningUrl({
        organizationId: "o1",
        envelopeId: "e-missing",
        recipientEmail: "a@b.com",
        returnUrl: "https://app/cb",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: E.ESIGN_ENVELOPE_NOT_FOUND,
    });
  });

  it("throws PRECONDITION_FAILED when externalEnvelopeId missing", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: "e1",
      externalEnvelopeId: null,
      provider: "DOCUSIGN",
      integrationConnectionId: "c1",
    });
    await expect(
      getSigningUrl({
        organizationId: "o1",
        envelopeId: "e1",
        recipientEmail: "a@b.com",
        returnUrl: "https://app/cb",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: E.ESIGN_NO_EXTERNAL_ID,
    });
  });

  it("returns embedded false when provider has no embedded URL", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: "e1",
      externalEnvelopeId: "ext-1",
      provider: "AUTENTI",
      integrationConnectionId: "c1",
    });
    vi.mocked(getEmbeddedSigningUrl).mockResolvedValue(null);

    const result = await getSigningUrl({
      organizationId: "o1",
      envelopeId: "e1",
      recipientEmail: "a@b.com",
      returnUrl: "https://app/cb",
    });

    expect(result).toEqual({ embedded: false, redirectUrl: null });
  });

  it("returns embedded URL when provider supports it", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: "e1",
      externalEnvelopeId: "ext-1",
      provider: "DOCUSIGN",
      integrationConnectionId: "c1",
    });
    const exp = new Date("2099-01-01");
    vi.mocked(getEmbeddedSigningUrl).mockResolvedValue({
      url: "https://sign.example/view",
      expiresAt: exp,
    });

    const result = await getSigningUrl({
      organizationId: "o1",
      envelopeId: "e1",
      recipientEmail: "a@b.com",
      returnUrl: "https://app/cb",
    });

    expect(result).toEqual({
      embedded: true,
      url: "https://sign.example/view",
      expiresAt: exp,
    });
  });
});

describe("handleSigningCompletion", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.document.create.mockResolvedValue({ id: "doc-signed-1" });
    mockTx.documentLink.create.mockResolvedValue({});
    mockTx.signingEvent.create.mockResolvedValue({});
    mockDocumentFindUnique.mockResolvedValue({ documentType: "CONTRACT" });
    vi.mocked(downloadSignedDocument).mockResolvedValue({
      documentBase64: Buffer.from("%PDF-1 signed").toString("base64"),
      fileName: "contract-signed.pdf",
      mimeType: "application/pdf",
    });
    vi.mocked(createPresignedUploadUrl).mockResolvedValue("https://r2.example/upload");
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when envelope not found", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue(null);
    await expect(handleSigningCompletion("e1", "c1", "DOCUSIGN")).rejects.toThrow(
      /not found or missing external ID/,
    );
  });

  it("downloads signed doc, uploads to R2, creates document and link", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: "env-int-1",
      externalEnvelopeId: "ext-out-1",
      organizationId: "o1",
      contractId: "contract-1",
      documentId: "orig-doc",
      recipients: [],
    });

    const doc = await handleSigningCompletion("env-int-1", "c1", "DOCUSIGN");

    expect(doc.id).toBe("doc-signed-1");
    expect(downloadSignedDocument).toHaveBeenCalledWith({
      provider: "DOCUSIGN",
      connectionId: "c1",
      envelopeId: "ext-out-1",
    });
    expect(createPresignedUploadUrl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example/upload",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockTx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "o1",
          source: "ESIGN",
          documentType: "CONTRACT",
        }),
      }),
    );
    expect(mockTx.documentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "CONTRACT",
          entityId: "contract-1",
          linkRole: "SIGNED_COPY",
        }),
      }),
    );
    expect(mockTx.signingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "SIGNED_PDF_SAVED" }),
      }),
    );
  });

  it("throws when R2 upload fails", async () => {
    mockSigningEnvelopeFindFirst.mockResolvedValue({
      id: "env-int-1",
      externalEnvelopeId: "ext-out-1",
      organizationId: "o1",
      contractId: null,
      documentId: null,
      recipients: [],
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(handleSigningCompletion("env-int-1", "c1", "DOCUSIGN")).rejects.toThrow(
      /Failed to upload signed PDF to R2/,
    );
  });
});
