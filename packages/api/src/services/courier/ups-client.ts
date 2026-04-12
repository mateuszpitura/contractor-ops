import { z } from "zod";

import type {
  CourierClient,
  CourierShipmentResult,
  CourierStatusResult,
  LabelFormat,
  ShipmentParams,
  UPSShipmentParams,
} from "./courier-client.js";

// ---------------------------------------------------------------------------
// UPS REST API Client
//
// Thin HTTP wrapper around the UPS REST APIs (Shipping, Tracking, Void).
// Uses OAuth 2.0 client_credentials flow with token caching.
// Uses globalThis.fetch for test mockability.
// ---------------------------------------------------------------------------

const UPS_SANDBOX_URL = "https://wwwcie.ups.com";
const UPS_PRODUCTION_URL = "https://onlinetools.ups.com";

/** Map abstract parcel sizes to UPS weight/dimensions. */
const UPS_SIZE_MAP = {
  small: {
    weight: { value: "2", unitOfMeasurement: { code: "KGS" } },
    dimensions: {
      length: "30",
      width: "20",
      height: "10",
      unitOfMeasurement: { code: "CM" },
    },
  },
  medium: {
    weight: { value: "5", unitOfMeasurement: { code: "KGS" } },
    dimensions: {
      length: "40",
      width: "30",
      height: "20",
      unitOfMeasurement: { code: "CM" },
    },
  },
  large: {
    weight: { value: "10", unitOfMeasurement: { code: "KGS" } },
    dimensions: {
      length: "60",
      width: "40",
      height: "30",
      unitOfMeasurement: { code: "CM" },
    },
  },
} as const;

/** Zod schema for OAuth token response. */
const oauthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

/** Zod schema for UPS create-shipment response. */
const upsShipmentResponseSchema = z.object({
  ShipmentResponse: z.object({
    ShipmentResults: z.object({
      ShipmentIdentificationNumber: z.string(),
      PackageResults: z.array(
        z.object({
          TrackingNumber: z.string(),
          ShippingLabel: z.object({
            GraphicImage: z.string(),
          }),
        }),
      ),
    }),
  }),
});

/** Zod schema for UPS tracking response. */
const upsTrackingResponseSchema = z.object({
  trackResponse: z.object({
    shipment: z.array(
      z.object({
        package: z.array(
          z.object({
            trackingNumber: z.string(),
            currentStatus: z.object({
              type: z.string(),
              description: z.string().optional(),
            }),
            deliveryDate: z.array(z.object({ date: z.string() })).optional(),
          }),
        ),
      }),
    ),
  }),
});

export interface UPSClientConfig {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  sandbox: boolean;
}

export class UPSClient implements CourierClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountNumber: string;
  private readonly sandbox: boolean;

  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: UPSClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accountNumber = config.accountNumber;
    this.sandbox = config.sandbox;
  }

  private get baseUrl(): string {
    return this.sandbox ? UPS_SANDBOX_URL : UPS_PRODUCTION_URL;
  }

  /**
   * Get an OAuth 2.0 access token, using the cache when possible.
   * Refreshes if the token is within a 5-minute expiry buffer.
   */
  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60_000) {
      return this.tokenCache.token;
    }

    const res = await globalThis.fetch(`${this.baseUrl}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "unknown");
      throw new Error(`[ups-client] OAuth failed: HTTP ${res.status} — ${errorBody}`);
    }

    const json = await res.json();
    const data = oauthResponseSchema.parse(json);

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a shipment via UPS Shipping API.
   *
   * POST /api/shipments/v2409/ship
   */
  async createShipment(params: ShipmentParams): Promise<CourierShipmentResult> {
    if (!("deliveryAddress" in params) || !("serviceCode" in params)) {
      throw new Error(
        "[ups-client] createShipment requires deliveryAddress and serviceCode for UPS shipments",
      );
    }
    const upsParams = params as UPSShipmentParams;

    const url = `${this.baseUrl}/api/shipments/v2409/ship`;
    const headers = await this.authHeaders();
    const size = UPS_SIZE_MAP[upsParams.parcelSize];

    const body = {
      ShipmentRequest: {
        Shipment: {
          Description: upsParams.reference ?? "Equipment shipment",
          Shipper: {
            Name: upsParams.sender.name,
            ShipperNumber: this.accountNumber,
            Phone: { Number: upsParams.sender.phone },
            Address: {
              AddressLine: [upsParams.sender.street],
              City: upsParams.sender.city,
              PostalCode: upsParams.sender.postalCode,
              CountryCode: upsParams.sender.countryCode,
            },
          },
          ShipTo: {
            Name: upsParams.receiver.name,
            Phone: { Number: upsParams.receiver.phone },
            Address: {
              AddressLine: [upsParams.deliveryAddress.street],
              City: upsParams.deliveryAddress.city,
              PostalCode: upsParams.deliveryAddress.postalCode,
              CountryCode: upsParams.deliveryAddress.countryCode,
            },
          },
          Service: { Code: upsParams.serviceCode },
          Package: [
            {
              PackagingType: { Code: "02" }, // Customer Supplied Package
              PackageWeight: size.weight,
              Dimensions: size.dimensions,
            },
          ],
          PaymentInformation: {
            ShipmentCharge: [
              {
                Type: "01", // Transportation
                BillShipper: { AccountNumber: this.accountNumber },
              },
            ],
          },
        },
        LabelSpecification: {
          LabelImageFormat: { Code: "PDF" },
        },
      },
    };

    const response = await globalThis.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(`[ups-client] createShipment failed: HTTP ${response.status} — ${errorBody}`);
    }

    const json = await response.json();
    const parsed = upsShipmentResponseSchema.parse(json);
    const results = parsed.ShipmentResponse.ShipmentResults;
    const pkg = results.PackageResults[0];

    return {
      externalId: results.ShipmentIdentificationNumber,
      trackingNumber: pkg.TrackingNumber,
      status: "CREATED",
      labelUrl: undefined, // Label is embedded as base64, not URL
    };
  }

  /**
   * Download shipment label as PDF.
   *
   * For UPS, labels are returned in createShipment response as base64.
   * This method re-fetches via the tracking/label endpoint.
   */
  async getLabel(shipmentExternalId: string, _format: LabelFormat = "pdf"): Promise<Buffer> {
    const url = `${this.baseUrl}/api/shipments/v2409/label/${shipmentExternalId}`;
    const headers = await this.authHeaders();

    const response = await globalThis.fetch(url, {
      method: "GET",
      headers: { ...headers, Accept: "application/pdf" },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(`[ups-client] getLabel failed: HTTP ${response.status} — ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get current shipment status from UPS Tracking API.
   *
   * GET /api/track/v1/details/{trackingNumber}
   */
  async getStatus(shipmentExternalId: string): Promise<CourierStatusResult> {
    const url = `${this.baseUrl}/api/track/v1/details/${shipmentExternalId}`;
    const headers = await this.authHeaders();

    const response = await globalThis.fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(`[ups-client] getStatus failed: HTTP ${response.status} — ${errorBody}`);
    }

    const json = await response.json();
    const parsed = upsTrackingResponseSchema.parse(json);
    const pkg = parsed.trackResponse.shipment[0].package[0];

    return {
      externalId: shipmentExternalId,
      status: pkg.currentStatus.type,
      trackingNumber: pkg.trackingNumber,
      updatedAt: pkg.deliveryDate?.[0]?.date,
    };
  }

  /**
   * Cancel (void) a shipment via UPS API.
   *
   * DELETE /api/shipments/v2409/void/cancel/{shipmentId}
   */
  async cancelShipment(shipmentExternalId: string): Promise<void> {
    const url = `${this.baseUrl}/api/shipments/v2409/void/cancel/${shipmentExternalId}`;
    const headers = await this.authHeaders();

    const response = await globalThis.fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(`[ups-client] cancelShipment failed: HTTP ${response.status} — ${errorBody}`);
    }
  }
}
