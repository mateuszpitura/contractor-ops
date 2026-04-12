import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UPSShipmentParams } from "../courier-client";
import { UPSClient } from "../ups-client";

// ---------------------------------------------------------------------------
// UPS Client Tests
// ---------------------------------------------------------------------------

const TEST_CONFIG = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  accountNumber: "ACC123",
  sandbox: true,
};

const UPS_SANDBOX_BASE = "https://wwwcie.ups.com";
const UPS_PRODUCTION_BASE = "https://onlinetools.ups.com";

function createClient(overrides?: Partial<typeof TEST_CONFIG>) {
  return new UPSClient({ ...TEST_CONFIG, ...overrides });
}

/** Build a mock fetch that handles multiple sequential calls with different responses. */
function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    const status = resp.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(JSON.stringify(resp.body)),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("PDF_CONTENT").buffer),
    });
  });
}

function mockFetchResponse(body: unknown, status = 200) {
  return mockFetchSequence([{ body, status }]);
}

const OAUTH_RESPONSE = {
  access_token: "test-bearer-token",
  token_type: "Bearer",
  expires_in: 3600,
};

const SHIPMENT_PARAMS: UPSShipmentParams = {
  organizationId: "org-abc",
  direction: "OUTBOUND",
  receiver: {
    name: "Jan Kowalski",
    email: "jan@example.com",
    phone: "500600700",
  },
  sender: {
    name: "Firma Sp. z o.o.",
    email: "office@firma.pl",
    phone: "221234567",
    street: "ul. Testowa 1",
    city: "Warszawa",
    postalCode: "00-001",
    countryCode: "PL",
  },
  deliveryAddress: {
    street: "ul. Odbiorcza 5",
    city: "Krakow",
    postalCode: "30-001",
    countryCode: "PL",
  },
  parcelSize: "medium",
  serviceCode: "11",
  reference: "SHIP-001",
};

describe("UPSClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("OAuth token management", () => {
    it("fetches OAuth token with Basic auth header and caches it", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z999",
                      currentStatus: { type: "I", description: "In Transit" },
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient();
      await client.getStatus("1Z999");

      // First call should be OAuth
      const [oauthUrl, oauthOptions] = mockFetch.mock.calls[0];
      expect(oauthUrl).toContain("/security/v1/oauth/token");
      expect(oauthOptions.method).toBe("POST");
      expect(oauthOptions.headers.Authorization).toContain("Basic ");
      expect(oauthOptions.body).toBe("grant_type=client_credentials");
    });

    it("returns cached token when not expired (no new fetch)", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z999",
                      currentStatus: { type: "I", description: "In Transit" },
                    },
                  ],
                },
              ],
            },
          },
        },
        // Second getStatus - should NOT trigger another OAuth call
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z999",
                      currentStatus: { type: "D", description: "Delivered" },
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient();
      await client.getStatus("1Z999");
      await client.getStatus("1Z999");

      // Should be 3 calls total: 1 OAuth + 2 getStatus (not 2 OAuth + 2 getStatus)
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Only the first call should be to OAuth
      expect(mockFetch.mock.calls[0][0]).toContain("/oauth/token");
      expect(mockFetch.mock.calls[1][0]).toContain("/track/");
      expect(mockFetch.mock.calls[2][0]).toContain("/track/");
    });

    it("refreshes token when within 5-minute expiry buffer", async () => {
      // First token expires in 4 minutes (within 5-min buffer)
      const shortLivedToken = {
        access_token: "short-lived-token",
        token_type: "Bearer",
        expires_in: 240, // 4 minutes < 5-minute buffer
      };

      const freshToken = {
        access_token: "fresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      };

      const mockFetch = mockFetchSequence([
        { body: shortLivedToken },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z999",
                      currentStatus: { type: "I", description: "In Transit" },
                    },
                  ],
                },
              ],
            },
          },
        },
        // Second call: should fetch new token since the short one is within buffer
        { body: freshToken },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z999",
                      currentStatus: { type: "D", description: "Delivered" },
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient();
      await client.getStatus("1Z999");
      await client.getStatus("1Z999");

      // Should be 4 calls: 2 OAuth + 2 getStatus (token refreshed because short-lived)
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockFetch.mock.calls[0][0]).toContain("/oauth/token");
      expect(mockFetch.mock.calls[2][0]).toContain("/oauth/token");
    });
  });

  describe("createShipment", () => {
    it("sends POST to UPS Shipping API with bearer token and correct payload", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            ShipmentResponse: {
              ShipmentResults: {
                ShipmentIdentificationNumber: "1ZSHIP123",
                PackageResults: [
                  {
                    TrackingNumber: "1ZTRACK456",
                    ShippingLabel: {
                      GraphicImage: Buffer.from("PDF_LABEL").toString("base64"),
                    },
                  },
                ],
              },
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient();
      const result = await client.createShipment(SHIPMENT_PARAMS);

      // Second call is createShipment
      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toContain("/api/shipments/v2409/ship");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer test-bearer-token");

      // Verify body structure
      const body = JSON.parse(options.body);
      expect(body.ShipmentRequest).toBeDefined();
      expect(body.ShipmentRequest.Shipment.Service.Code).toBe("11");
      expect(body.ShipmentRequest.Shipment.ShipTo.Address.City).toBe("Krakow");

      // Verify result
      expect(result.externalId).toBe("1ZSHIP123");
      expect(result.trackingNumber).toBe("1ZTRACK456");
    });
  });

  describe("getStatus", () => {
    it("sends GET to UPS Tracking API with bearer token", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1ZTRACK456",
                      currentStatus: { type: "D", description: "Delivered" },
                      deliveryDate: [{ date: "20260404" }],
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient();
      const result = await client.getStatus("1ZTRACK456");

      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toContain("/api/track/v1/details/1ZTRACK456");
      expect(options.method).toBe("GET");
      expect(options.headers.Authorization).toBe("Bearer test-bearer-token");

      expect(result).toEqual({
        externalId: "1ZTRACK456",
        status: "D",
        trackingNumber: "1ZTRACK456",
        updatedAt: "20260404",
      });
    });
  });

  describe("sandbox vs production URL", () => {
    it("uses sandbox URL (wwwcie.ups.com) when sandbox=true", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z",
                      currentStatus: { type: "I", description: "" },
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient({ sandbox: true });
      await client.getStatus("1Z");

      expect(mockFetch.mock.calls[0][0]).toContain("wwwcie.ups.com");
    });

    it("uses production URL (onlinetools.ups.com) when sandbox=false", async () => {
      const mockFetch = mockFetchSequence([
        { body: OAUTH_RESPONSE },
        {
          body: {
            trackResponse: {
              shipment: [
                {
                  package: [
                    {
                      trackingNumber: "1Z",
                      currentStatus: { type: "I", description: "" },
                    },
                  ],
                },
              ],
            },
          },
        },
      ]);
      globalThis.fetch = mockFetch;

      const client = createClient({ sandbox: false });
      await client.getStatus("1Z");

      expect(mockFetch.mock.calls[0][0]).toContain("onlinetools.ups.com");
      expect(mockFetch.mock.calls[0][0]).not.toContain("wwwcie");
    });
  });
});
