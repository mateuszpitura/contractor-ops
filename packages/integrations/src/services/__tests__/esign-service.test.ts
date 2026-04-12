import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAdapters, registerAdapter } from "../../registry.js";
import type { NormalizedSigningEvent } from "../../types/esign.js";
import type { IntegrationProviderAdapter } from "../../types/provider.js";
import {
  createSigningEnvelope,
  downloadSignedDocument,
  getEmbeddedSigningUrl,
  getESignAdapter,
  normalizeSigningEvent,
  resendSigningNotification,
  voidSigningEnvelope,
} from "../esign-service.js";

function makeMockEsignAdapter(over: { supportsEmbeddedSigning?: boolean } = {}) {
  const supportsEmbeddedSigning = over.supportsEmbeddedSigning ?? true;
  return {
    slug: "docusign",
    displayName: "DocuSign",
    supportsOAuth: true,
    supportsWebhooks: true,
    supportsEmbeddedSigning,
    createEnvelope: vi.fn(async () => ({
      externalEnvelopeId: "ext-1",
      status: "SENT",
      signers: [],
    })),
    getEmbeddedSigningUrl: vi.fn(async () => ({
      url: "https://sign.example/view",
    })),
    getSignedDocument: vi.fn(async () => ({
      documentBase64: "YQ==",
      mimeType: "application/pdf",
      fileName: "a.pdf",
    })),
    getEnvelopeStatus: vi.fn(),
    voidEnvelope: vi.fn(async () => undefined),
    resendToRecipient: vi.fn(async () => undefined),
    normalizeWebhookEvent: vi.fn(
      (): NormalizedSigningEvent => ({
        externalEnvelopeId: "ext-1",
        eventType: "ENVELOPE_SENT",
        description: "test",
        occurredAt: new Date(),
      }),
    ),
  };
}

describe("esign-service", () => {
  beforeEach(() => {
    clearAdapters();
    vi.clearAllMocks();
  });

  describe("getESignAdapter", () => {
    it("throws when adapter is not registered", () => {
      expect(() => getESignAdapter("DOCUSIGN")).toThrow("No adapter registered");
    });

    it("throws when adapter lacks createEnvelope", () => {
      registerAdapter({
        slug: "docusign",
        displayName: "X",
        supportsOAuth: true,
        supportsWebhooks: true,
      } as IntegrationProviderAdapter);

      expect(() => getESignAdapter("DOCUSIGN")).toThrow(
        "does not implement the ESignAdapter interface",
      );
    });

    it("resolves registered DocuSign adapter", () => {
      const mock = makeMockEsignAdapter();
      registerAdapter(mock as unknown as IntegrationProviderAdapter);

      const a = getESignAdapter("DOCUSIGN");
      expect(a.supportsEmbeddedSigning).toBe(true);
    });
  });

  describe("facade functions", () => {
    let mockAdapter: ReturnType<typeof makeMockEsignAdapter>;

    beforeEach(() => {
      mockAdapter = makeMockEsignAdapter();
      registerAdapter(mockAdapter as unknown as IntegrationProviderAdapter);
    });

    it("createSigningEnvelope delegates to adapter", async () => {
      const req = {
        documentBase64: "YQ==",
        documentName: "a.pdf",
        signers: [
          {
            name: "A",
            email: "a@example.com",
            role: "signer" as const,
            routingOrder: 1,
          },
        ],
      };

      const result = await createSigningEnvelope({
        provider: "DOCUSIGN",
        connectionId: "conn-1",
        request: req,
      });

      expect(result.externalEnvelopeId).toBe("ext-1");
      expect(mockAdapter.createEnvelope).toHaveBeenCalledWith("conn-1", req);
    });

    it("getEmbeddedSigningUrl returns null when embedded signing unsupported", async () => {
      clearAdapters();
      const mock = makeMockEsignAdapter({ supportsEmbeddedSigning: false });
      registerAdapter(mock as unknown as IntegrationProviderAdapter);

      const url = await getEmbeddedSigningUrl({
        provider: "DOCUSIGN",
        connectionId: "c",
        envelopeId: "e",
        recipientEmail: "a@example.com",
        returnUrl: "https://app/cb",
      });

      expect(url).toBeNull();
      expect(mock.getEmbeddedSigningUrl).not.toHaveBeenCalled();
    });

    it("getEmbeddedSigningUrl delegates when supported", async () => {
      const out = await getEmbeddedSigningUrl({
        provider: "DOCUSIGN",
        connectionId: "c",
        envelopeId: "e",
        recipientEmail: "a@example.com",
        returnUrl: "https://app/cb",
      });
      expect(out?.url).toBe("https://sign.example/view");
    });

    it("downloadSignedDocument delegates", async () => {
      const doc = await downloadSignedDocument({
        provider: "DOCUSIGN",
        connectionId: "c",
        envelopeId: "e",
      });
      expect(doc.fileName).toBe("a.pdf");
    });

    it("voidSigningEnvelope delegates", async () => {
      await voidSigningEnvelope({
        provider: "DOCUSIGN",
        connectionId: "c",
        envelopeId: "e",
        reason: "test",
      });
      expect(mockAdapter.voidEnvelope).toHaveBeenCalledWith("c", "e", "test");
    });

    it("resendSigningNotification delegates", async () => {
      await resendSigningNotification({
        provider: "DOCUSIGN",
        connectionId: "c",
        envelopeId: "e",
        recipientEmail: "a@example.com",
      });
      expect(mockAdapter.resendToRecipient).toHaveBeenCalledWith("c", "e", "a@example.com");
    });

    it("normalizeSigningEvent delegates", () => {
      const ev = normalizeSigningEvent("DOCUSIGN", { raw: true });
      expect(ev.externalEnvelopeId).toBe("ext-1");
    });
  });
});
