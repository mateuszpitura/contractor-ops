import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { InPostClient } from "../inpost-client";
import type { InPostShipmentParams } from "../courier-client";

// ---------------------------------------------------------------------------
// InPost Client Tests
// ---------------------------------------------------------------------------

const TEST_CONFIG = {
  apiToken: "test-token-123",
  shipxOrganizationId: "org-456",
  sandbox: true,
};

const SANDBOX_BASE = "https://sandbox-api-shipx-pl.easypack24.net";

function createClient() {
  return new InPostClient(TEST_CONFIG);
}

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () =>
      Promise.resolve(new TextEncoder().encode("PDF_CONTENT").buffer),
  });
}

describe("InPostClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("createShipment", () => {
    it("sends POST to correct URL with correct payload and returns CourierShipmentResult", async () => {
      const mockFetch = mockFetchResponse({
        id: 12345678,
        tracking_number: "620123456789012345678",
        status: "created",
        href: "https://sandbox-api-shipx-pl.easypack24.net/v1/shipments/12345678",
      });
      globalThis.fetch = mockFetch;

      const client = createClient();
      const params: InPostShipmentParams = {
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
        },
        targetPoint: "KRA012",
        parcelSize: "medium",
        reference: "SHIP-001",
      };

      const result = await client.createShipment(params);

      // Verify URL
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        `${SANDBOX_BASE}/v1/organizations/${TEST_CONFIG.shipxOrganizationId}/shipments`,
      );

      // Verify method and headers
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe(
        `Bearer ${TEST_CONFIG.apiToken}`,
      );
      expect(options.headers["Content-Type"]).toBe("application/json");

      // Verify body
      const body = JSON.parse(options.body);
      expect(body.receiver.name).toBe("Jan Kowalski");
      expect(body.parcels).toEqual([{ template: "medium" }]);
      expect(body.custom_attributes.target_point).toBe("KRA012");
      expect(body.custom_attributes.sending_method).toBe("dispatch_order");
      expect(body.service).toBe("inpost_locker_standard");
      expect(body.reference).toBe("SHIP-001");
      expect(body.external_customer_id).toBe("org-abc");

      // Verify result
      expect(result).toEqual({
        externalId: "12345678",
        trackingNumber: "620123456789012345678",
        status: "created",
        labelUrl:
          "https://sandbox-api-shipx-pl.easypack24.net/v1/shipments/12345678/label",
      });
    });

    it("throws on non-2xx response with status code and body", async () => {
      globalThis.fetch = mockFetchResponse(
        { error: "Invalid token" },
        401,
      );

      const client = createClient();
      await expect(
        client.createShipment({
          organizationId: "org-abc",
          direction: "OUTBOUND",
          receiver: {
            name: "Test",
            email: "t@t.com",
            phone: "123",
          },
          sender: {
            name: "Sender",
            email: "s@s.com",
            phone: "456",
          },
          targetPoint: "KRA001",
          parcelSize: "small",
        }),
      ).rejects.toThrow("HTTP 401");
    });
  });

  describe("getLabel", () => {
    it("sends GET with Accept: application/pdf", async () => {
      const mockFetch = mockFetchResponse({}, 200);
      globalThis.fetch = mockFetch;

      const client = createClient();
      const result = await client.getLabel("12345678", "pdf");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${SANDBOX_BASE}/v1/shipments/12345678/label`);
      expect(options.method).toBe("GET");
      expect(options.headers.Accept).toBe("application/pdf");
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("sends GET and returns mapped result", async () => {
      globalThis.fetch = mockFetchResponse({
        id: 12345678,
        tracking_number: "620123456789012345678",
        status: "delivered",
        updated_at: "2026-04-04T10:00:00Z",
      });

      const client = createClient();
      const result = await client.getStatus("12345678");

      expect(result).toEqual({
        externalId: "12345678",
        status: "delivered",
        trackingNumber: "620123456789012345678",
        updatedAt: "2026-04-04T10:00:00Z",
      });
    });
  });

  describe("cancelShipment", () => {
    it("sends DELETE to correct URL", async () => {
      const mockFetch = mockFetchResponse({}, 200);
      globalThis.fetch = mockFetch;

      const client = createClient();
      await client.cancelShipment("12345678");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${SANDBOX_BASE}/v1/shipments/12345678`);
      expect(options.method).toBe("DELETE");
    });
  });

  describe("production URL", () => {
    it("uses production base URL when sandbox is false", async () => {
      const mockFetch = mockFetchResponse({
        id: 1,
        tracking_number: "T1",
        status: "created",
      });
      globalThis.fetch = mockFetch;

      const client = new InPostClient({
        ...TEST_CONFIG,
        sandbox: false,
      });

      await client.getStatus("1");
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("api-shipx-pl.easypack24.net");
      expect(url).not.toContain("sandbox");
    });
  });
});
