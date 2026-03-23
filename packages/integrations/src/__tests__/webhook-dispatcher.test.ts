import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the registry
vi.mock("../registry.js", () => ({
  getAdapter: vi.fn(),
}));

// Mock prisma
vi.mock("@contractor-ops/db", () => ({
  prisma: {
    webhookDelivery: {
      create: vi.fn(),
    },
  },
}));

// Mock QStash client (path relative to the source module that imports it)
vi.mock("../services/qstash-client.js", () => ({
  getQStashClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getAdapter } from "../registry.js";
import { prisma } from "@contractor-ops/db";
import { getQStashClient } from "../services/qstash-client.js";
import type { Client } from "@upstash/qstash";
import {
  dispatchWebhook,
  logWebhookDelivery,
  queueWebhookProcessing,
} from "../services/webhook-dispatcher.js";
import type { IntegrationProviderAdapter } from "../types/provider.js";

const mockGetAdapter = vi.mocked(getAdapter);
const mockPrismaCreate = vi.mocked(prisma.webhookDelivery.create);
const mockGetQStashClient = vi.mocked(getQStashClient);

describe("webhook-dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("dispatchWebhook", () => {
    it("should call adapter.verifyWebhookSignature with correct args", () => {
      const mockVerify = vi.fn().mockReturnValue({
        valid: true,
        eventType: "block_actions",
      });

      const mockAdapter = {
        slug: "slack",
        displayName: "Slack",
        supportsOAuth: true,
        supportsWebhooks: true,
        verifyWebhookSignature: mockVerify,
      } as unknown as IntegrationProviderAdapter;

      mockGetAdapter.mockReturnValue(mockAdapter);

      const rawBody = "payload=test";
      const headers = {
        "x-slack-request-timestamp": "12345",
        "x-slack-signature": "v0=abc",
      };

      const result = dispatchWebhook("slack", rawBody, headers);

      expect(mockGetAdapter).toHaveBeenCalledWith("slack");
      expect(mockVerify).toHaveBeenCalledWith(rawBody, headers);
      expect(result).toEqual({
        valid: true,
        eventType: "block_actions",
      });
    });

    it("should throw when adapter not found", () => {
      mockGetAdapter.mockReturnValue(undefined);

      expect(() =>
        dispatchWebhook("unknown", "body", {}),
      ).toThrow("No adapter registered for provider: unknown");
    });

    it("should throw when adapter does not support webhook verification", () => {
      const mockAdapter = {
        slug: "test",
        displayName: "Test",
        supportsOAuth: false,
        supportsWebhooks: false,
      } as IntegrationProviderAdapter;

      mockGetAdapter.mockReturnValue(mockAdapter);

      expect(() =>
        dispatchWebhook("test", "body", {}),
      ).toThrow('Adapter "test" does not support webhook signature verification');
    });
  });

  describe("logWebhookDelivery", () => {
    it("should call prisma.webhookDelivery.create with correct data shape", async () => {
      const mockDelivery = {
        id: "delivery-123",
        organizationId: "org-1",
        provider: "SLACK",
        eventType: "block_actions",
        signatureValid: true,
        payloadJson: { type: "block_actions" },
        deliveryStatus: "RECEIVED",
        integrationConnectionId: null,
      };

      mockPrismaCreate.mockResolvedValue(mockDelivery as never);

      const result = await logWebhookDelivery({
        organizationId: "org-1",
        provider: "slack",
        eventType: "block_actions",
        signatureValid: true,
        payloadJson: { type: "block_actions" },
      });

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          provider: "SLACK",
          eventType: "block_actions",
          signatureValid: true,
          payloadJson: { type: "block_actions" },
          deliveryStatus: "RECEIVED",
          integrationConnectionId: null,
        },
      });

      expect(result).toEqual(mockDelivery);
    });

    it("should include connectionId when provided", async () => {
      mockPrismaCreate.mockResolvedValue({} as never);

      await logWebhookDelivery({
        organizationId: "org-1",
        provider: "resend",
        eventType: "email.received",
        signatureValid: true,
        payloadJson: {},
        connectionId: "conn-456",
      });

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationConnectionId: "conn-456",
        }),
      });
    });
  });

  describe("queueWebhookProcessing", () => {
    it("should publish to QStash with correct URL and body", async () => {
      const mockPublishJSON = vi.fn().mockResolvedValue({});
      mockGetQStashClient.mockReturnValue({
        publishJSON: mockPublishJSON,
      } as never);

      await queueWebhookProcessing("delivery-123", "slack");

      expect(mockPublishJSON).toHaveBeenCalledWith({
        url: "https://app.test.com/api/webhooks/_process",
        body: { deliveryId: "delivery-123", provider: "slack" },
        retries: 3,
      });
    });
  });
});
