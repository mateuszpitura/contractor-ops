import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GovApiClient } from "../client.js";
import type { GovApiConfig, GovApiAuditEntry } from "../types.js";

// ---------------------------------------------------------------------------
// Test implementation
// ---------------------------------------------------------------------------

class TestGovApiClient extends GovApiClient {
  public auditEntries: GovApiAuditEntry[] = [];

  getApiName(): string {
    return "test-api";
  }

  // Expose protected fetch for testing
  async doFetch(
    path: string,
    options?: RequestInit,
    opts?: { organizationId?: string; skipAudit?: boolean },
  ) {
    return this.fetch(path, options, opts);
  }

  // Expose protected loadCertificate for testing
  async doLoadCertificate(path?: string) {
    return this.loadCertificate(path);
  }

  protected override emitAuditEntry(entry: GovApiAuditEntry): void {
    this.auditEntries.push(entry);
  }
}

const TEST_CONFIG: GovApiConfig = {
  baseUrls: {
    sandbox: "https://sandbox.gov.example.com/api",
    production: "https://prod.gov.example.com/api",
  },
  retry: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 },
  timeoutMs: 5000,
  certSecretPath: "certs/test-api",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GovApiClient", () => {
  let client: TestGovApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new TestGovApiClient(TEST_CONFIG, "sandbox");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getBaseUrl", () => {
    it("returns sandbox URL for sandbox environment", () => {
      expect(client.getBaseUrl("sandbox")).toBe(
        "https://sandbox.gov.example.com/api",
      );
    });

    it("returns production URL for production environment", () => {
      expect(client.getBaseUrl("production")).toBe(
        "https://prod.gov.example.com/api",
      );
    });

    it("uses current environment when no override given", () => {
      expect(client.getBaseUrl()).toBe(
        "https://sandbox.gov.example.com/api",
      );
    });
  });

  describe("fetch — success path", () => {
    it("makes a successful request", async () => {
      const mockResponse = new Response('{"ok":true}', { status: 200 });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://sandbox.gov.example.com/api/endpoint",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });

    it("sets Content-Type to application/json by default", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response("", { status: 200 }),
      );

      await client.doFetch("/endpoint");
      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const headers = callArgs?.[1]?.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("fetch — retry behavior", () => {
    it("retries on 500 status", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response("", { status: 500 }))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 502 status", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response("", { status: 502 }))
        .mockResolvedValueOnce(new Response("", { status: 200 }));

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 503 status", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response("", { status: 503 }))
        .mockResolvedValueOnce(new Response("", { status: 200 }));

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(200);
    });

    it("does NOT retry on 400 status", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response("", { status: 400 }),
      );

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(400);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on 401 status", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(401);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on 403 status", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response("", { status: 403 }),
      );

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(403);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on 404 status", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response("", { status: 404 }),
      );

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(404);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns last response after max retries exhausted", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response("", { status: 500 }))
        .mockResolvedValueOnce(new Response("", { status: 500 }))
        .mockResolvedValueOnce(new Response("", { status: 500 }));

      const response = await client.doFetch("/endpoint");
      expect(response.status).toBe(500);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe("fetch — certificate auth", () => {
    it("includes Authorization header when certificate is loaded", async () => {
      const mockStore = {
        get: vi.fn(async () => "test-cert-value"),
        set: vi.fn(),
        delete: vi.fn(),
      };
      client.setSecretStore(mockStore);
      await client.doLoadCertificate();

      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response("", { status: 200 }),
      );

      await client.doFetch("/endpoint");
      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const headers = callArgs?.[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-cert-value");
    });
  });

  describe("fetch — audit logging", () => {
    it("emits audit entry when organizationId is provided", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response("", { status: 200 }),
      );

      await client.doFetch("/endpoint", {}, { organizationId: "org-1" });
      expect(client.auditEntries).toHaveLength(1);
      expect(client.auditEntries[0]).toMatchObject({
        apiName: "test-api",
        organizationId: "org-1",
        endpoint: "/endpoint",
        method: "GET",
        responseStatus: 200,
      });
    });

    it("does not emit audit entry when skipAudit is true", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response("", { status: 200 }),
      );

      await client.doFetch(
        "/endpoint",
        {},
        { organizationId: "org-1", skipAudit: true },
      );
      expect(client.auditEntries).toHaveLength(0);
    });
  });

  describe("loadCertificate", () => {
    it("loads certificate from secret store", async () => {
      const mockStore = {
        get: vi.fn(async () => "my-cert"),
        set: vi.fn(),
        delete: vi.fn(),
      };
      client.setSecretStore(mockStore);

      const cert = await client.doLoadCertificate();
      expect(cert).toBe("my-cert");
      expect(mockStore.get).toHaveBeenCalledWith("certs/test-api");
    });

    it("caches certificate after first load", async () => {
      const mockStore = {
        get: vi.fn(async () => "my-cert"),
        set: vi.fn(),
        delete: vi.fn(),
      };
      client.setSecretStore(mockStore);

      await client.doLoadCertificate();
      await client.doLoadCertificate();
      expect(mockStore.get).toHaveBeenCalledTimes(1);
    });

    it("throws when no secret store is set", async () => {
      await expect(client.doLoadCertificate()).rejects.toThrow(
        "SecretStore not set",
      );
    });

    it("throws when certificate not found", async () => {
      const mockStore = {
        get: vi.fn(async () => null),
        set: vi.fn(),
        delete: vi.fn(),
      };
      client.setSecretStore(mockStore);

      await expect(client.doLoadCertificate()).rejects.toThrow(
        "Certificate not found",
      );
    });
  });
});
