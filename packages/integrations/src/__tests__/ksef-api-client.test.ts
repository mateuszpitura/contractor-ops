import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { KsefApiClient } from "../services/ksef-api-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

// Generate a real RSA key pair for testing the crypto path
let TEST_PUBLIC_KEY_PEM: string;

beforeAll(() => {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  TEST_PUBLIC_KEY_PEM = publicKey as string;
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("KsefApiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.clearAllMocks();
  });

  /**
   * Sets up fetch mocks for the full authentication flow.
   */
  function mockAuthFlow() {
    fetchMock
      // Step 1: GET /auth/public-key
      .mockResolvedValueOnce(
        jsonResponse({ publicKey: TEST_PUBLIC_KEY_PEM }),
      )
      // Step 2: POST /auth/challenge
      .mockResolvedValueOnce(
        jsonResponse({ challenge: "test-challenge-123", timestampMs: Date.now() }),
      )
      // Step 3: POST /auth/token/redeem
      .mockResolvedValueOnce(
        jsonResponse({
          jwt: "test-jwt-token-abc",
          referenceNumber: "KSEF-REF-SESSION-001",
        }),
      )
      // Step 4: GET /auth/{referenceNumber} — session ready
      .mockResolvedValueOnce(
        jsonResponse({ status: "READY", processingCode: 200 }),
      );
  }

  describe("authenticate", () => {
    it("performs RSA-OAEP challenge-response authentication", async () => {
      mockAuthFlow();

      const client = new KsefApiClient("test");
      const session = await client.authenticate("test-token", "1234567890");

      expect(session.jwt).toBe("test-jwt-token-abc");
      expect(session.referenceNumber).toBe("KSEF-REF-SESSION-001");
      expect(fetchMock).toHaveBeenCalledTimes(4);

      // Verify correct endpoints were called
      const calls = fetchMock.mock.calls;
      expect(calls[0]![0]).toContain("/auth/public-key");
      expect(calls[1]![0]).toContain("/auth/challenge");
      expect(calls[2]![0]).toContain("/auth/token/redeem");
      expect(calls[3]![0]).toContain("/auth/KSEF-REF-SESSION-001");
    });

    it("throws on invalid credentials", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ publicKey: TEST_PUBLIC_KEY_PEM }))
        .mockResolvedValueOnce(
          textResponse("Unauthorized", 401),
        );

      const client = new KsefApiClient("test");
      await expect(
        client.authenticate("bad-token", "1234567890"),
      ).rejects.toThrow("KSeF API error 401");
    });
  });

  describe("queryInvoices", () => {
    it("starts query and polls until complete", async () => {
      mockAuthFlow();

      const invoiceMetadata = [
        {
          ksefReferenceNumber: "KSEF-INV-001",
          invoiceNumber: "FV/001",
          subjectNip: "1234567890",
          invoiceDate: "2026-03-15",
        },
      ];

      // Query start
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ queryId: "query-123" }),
      );
      // Query poll — completed
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          status: "COMPLETED",
          processingCode: 200,
          invoiceMetadataList: invoiceMetadata,
          hasMore: false,
        }),
      );

      const client = new KsefApiClient("test");
      await client.authenticate("test-token", "1234567890");
      const result = await client.queryInvoices(
        "1234567890",
        "2026-03-01",
        "2026-03-31",
      );

      expect(result.invoiceMetadataList).toHaveLength(1);
      expect(result.invoiceMetadataList[0]!.ksefReferenceNumber).toBe(
        "KSEF-INV-001",
      );
      expect(result.hasMore).toBe(false);
    });

    it("throws when not authenticated", async () => {
      const client = new KsefApiClient("test");

      await expect(
        client.queryInvoices("1234567890", "2026-03-01", "2026-03-31"),
      ).rejects.toThrow("KSeF session not established");
    });
  });

  describe("verifyCredentials", () => {
    it("returns true for valid credentials", async () => {
      mockAuthFlow();
      // terminate session call
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

      const client = new KsefApiClient("test");
      const result = await client.verifyCredentials(
        "test-token",
        "1234567890",
      );

      expect(result).toBe(true);
    });

    it("returns false for invalid credentials", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ publicKey: TEST_PUBLIC_KEY_PEM }))
        .mockResolvedValueOnce(textResponse("Unauthorized", 401));

      const client = new KsefApiClient("test");
      const result = await client.verifyCredentials(
        "bad-token",
        "1234567890",
      );

      expect(result).toBe(false);
    });
  });

  describe("fetchWithRetry", () => {
    it("retries on 429 with backoff", async () => {
      mockAuthFlow();

      // Download call: first 429, then 200
      fetchMock.mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      );
      fetchMock.mockResolvedValueOnce(
        new Response("<xml>invoice</xml>", {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }),
      );

      const client = new KsefApiClient("test");
      await client.authenticate("test-token", "1234567890");

      const xml = await client.downloadInvoiceXml("KSEF-INV-001");
      expect(xml).toBe("<xml>invoice</xml>");
    });
  });
});
