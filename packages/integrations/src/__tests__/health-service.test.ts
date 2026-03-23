import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    integrationConnection: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    integrationSyncLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    webhookDelivery: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

// Mock registry
vi.mock("../registry.js", () => ({
  getAllAdapters: () => [
    { slug: "slack", displayName: "Slack", supportsOAuth: true, supportsWebhooks: true },
    { slug: "resend", displayName: "Resend", supportsOAuth: false, supportsWebhooks: true },
  ],
}));

import { getProviderHealth, getAllProviderHealth } from "../services/health-service.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("health-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProviderHealth", () => {
    it("returns DISCONNECTED when no connection exists", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getProviderHealth("org-1", "slack");

      expect(result).toEqual({
        status: "DISCONNECTED",
        provider: "slack",
        displayName: null,
        connectedAt: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        tokenExpiresAt: null,
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      });
    });

    it("returns full status when connection exists", async () => {
      const connectedAt = new Date("2026-03-01T10:00:00Z");
      const lastSyncAt = new Date("2026-03-22T08:00:00Z");
      const syncStarted = new Date("2026-03-22T08:00:00Z");
      const webhookReceived = new Date("2026-03-22T09:00:00Z");

      mockFindFirst.mockResolvedValue({
        id: "conn-1",
        status: "CONNECTED",
        displayName: "Test Workspace",
        connectedAt,
        lastSyncAt,
        lastSuccessAt: lastSyncAt,
        lastErrorAt: null,
        lastErrorMessage: null,
        tokenExpiresAt: new Date("2026-04-01T00:00:00Z"),
        connectedBy: { id: "user-1", name: "Admin User" },
      });

      // First findMany call = sync logs, second = webhook deliveries
      mockFindMany
        .mockResolvedValueOnce([
          {
            id: "sync-1",
            syncType: "FULL",
            status: "SUCCESS",
            startedAt: syncStarted,
            completedAt: new Date("2026-03-22T08:01:00Z"),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "wh-1",
            eventType: "message.created",
            deliveryStatus: "PROCESSED",
            receivedAt: webhookReceived,
            processedAt: new Date("2026-03-22T09:00:01Z"),
          },
        ]);

      mockCount.mockResolvedValue(0);

      const result = await getProviderHealth("org-1", "slack");

      expect(result.status).toBe("CONNECTED");
      expect(result.provider).toBe("slack");
      expect(result.displayName).toBe("Test Workspace");
      expect(result.recentSyncs).toHaveLength(1);
      expect(result.recentSyncs[0]!.syncType).toBe("FULL");
      expect(result.recentWebhooks).toHaveLength(1);
      expect(result.recentWebhooks[0]!.eventType).toBe("message.created");
      expect(result.errorCountLast24h).toBe(0);
    });

    it("counts only FAILED syncs within last 24 hours for errorCountLast24h", async () => {
      mockFindFirst.mockResolvedValue({
        id: "conn-1",
        status: "ERROR",
        displayName: "Test Workspace",
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastSuccessAt: null,
        lastErrorAt: new Date(),
        lastErrorMessage: "Token revoked",
        tokenExpiresAt: null,
        connectedBy: { id: "user-1", name: "Admin" },
      });

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(3);

      const result = await getProviderHealth("org-1", "slack");

      expect(result.status).toBe("ERROR");
      expect(result.errorCountLast24h).toBe(3);

      // Verify the count query filters by FAILED status and 24h window
      const countCall = mockCount.mock.calls[0]![0] as {
        where: { status: string; startedAt: { gte: Date } };
      };
      expect(countCall.where.status).toBe("FAILED");
      expect(countCall.where.startedAt.gte).toBeInstanceOf(Date);
      // The gte date should be roughly 24 hours ago
      const diff = Date.now() - countCall.where.startedAt.gte.getTime();
      expect(diff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
      expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });
  });

  describe("getAllProviderHealth", () => {
    it("returns health for all registered adapters", async () => {
      // Both providers are disconnected
      mockFindFirst.mockResolvedValue(null);

      const results = await getAllProviderHealth("org-1");

      expect(results).toHaveLength(2);
      expect(results[0]!.provider).toBe("slack");
      expect(results[0]!.status).toBe("DISCONNECTED");
      expect(results[1]!.provider).toBe("resend");
      expect(results[1]!.status).toBe("DISCONNECTED");
    });
  });
});
