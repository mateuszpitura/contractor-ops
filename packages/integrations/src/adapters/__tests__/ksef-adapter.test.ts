import { beforeEach, describe, expect, it, vi } from "vitest";
import { KsefAdapter } from "../ksef-adapter.js";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    integrationConnection: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    integrationSyncLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

describe("KsefAdapter", () => {
  let adapter: KsefAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new KsefAdapter();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
  });

  it("returns DISCONNECTED when connection is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    const h = await adapter.getHealthStatus("conn-missing");

    expect(h.status).toBe("DISCONNECTED");
    expect(h.provider).toBe("ksef");
    expect(h.recentSyncs).toEqual([]);
    expect(h.errorCountLast24h).toBe(0);
  });

  it("returns REAUTH_REQUIRED when token is expired", async () => {
    const past = new Date(Date.now() - 60_000);
    mockFindUnique.mockResolvedValue({
      provider: "KSEF",
      displayName: "KSeF",
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: past,
      status: "CONNECTED",
    });

    const h = await adapter.getHealthStatus("conn-1");

    expect(h.status).toBe("REAUTH_REQUIRED");
  });

  it("returns ERROR when connected but only lastError and no success", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "KSEF",
      displayName: "KSeF",
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: "sync failed",
      tokenExpiresAt: null,
      status: "CONNECTED",
    });

    const h = await adapter.getHealthStatus("conn-1");

    expect(h.status).toBe("ERROR");
  });

  it("returns CONNECTED when latest sync succeeded", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "KSEF",
      displayName: "KSeF",
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: null,
      status: "CONNECTED",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "log-1",
        syncType: "INVOICE",
        status: "SUCCESS",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const h = await adapter.getHealthStatus("conn-1");

    expect(h.status).toBe("CONNECTED");
    expect(h.recentSyncs).toHaveLength(1);
    expect(h.recentWebhooks).toEqual([]);
  });

  it("returns ERROR when most recent sync failed", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "KSEF",
      displayName: "KSeF",
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: null,
      status: "CONNECTED",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "log-1",
        syncType: "INVOICE",
        status: "FAILED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const h = await adapter.getHealthStatus("conn-1");

    expect(h.status).toBe("ERROR");
  });
});
