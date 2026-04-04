import { z } from "zod";

import type {
  CourierClient,
  CourierShipmentResult,
  CourierStatusResult,
  CreateShipmentParams,
  LabelFormat,
} from "./courier-client";

// ---------------------------------------------------------------------------
// InPost ShipX API Client
//
// Thin HTTP wrapper around the ShipX REST API v1.
// Uses globalThis.fetch for test mockability.
// ---------------------------------------------------------------------------

const SHIPX_SANDBOX_URL = "https://sandbox-api-shipx-pl.easypack24.net";
const SHIPX_PRODUCTION_URL = "https://api-shipx-pl.easypack24.net";

/** Zod schema for ShipX create-shipment response validation. */
const shipxCreateResponseSchema = z.object({
  id: z.number(),
  tracking_number: z.string(),
  status: z.string(),
  href: z.string().optional(),
});

/** Zod schema for ShipX get-status response validation. */
const shipxStatusResponseSchema = z.object({
  id: z.number(),
  tracking_number: z.string().optional(),
  status: z.string(),
  updated_at: z.string().optional(),
});

export interface InPostClientConfig {
  apiToken: string;
  shipxOrganizationId: string;
  sandbox: boolean;
}

export class InPostClient implements CourierClient {
  private readonly apiToken: string;
  private readonly shipxOrganizationId: string;
  private readonly sandbox: boolean;

  constructor(config: InPostClientConfig) {
    this.apiToken = config.apiToken;
    this.shipxOrganizationId = config.shipxOrganizationId;
    this.sandbox = config.sandbox;
  }

  private get baseUrl(): string {
    return this.sandbox ? SHIPX_SANDBOX_URL : SHIPX_PRODUCTION_URL;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a shipment via ShipX API.
   *
   * POST /v1/organizations/{orgId}/shipments
   */
  async createShipment(
    params: CreateShipmentParams,
  ): Promise<CourierShipmentResult> {
    const url = `${this.baseUrl}/v1/organizations/${this.shipxOrganizationId}/shipments`;

    const body = {
      receiver: {
        name: params.receiver.name,
        email: params.receiver.email,
        phone: params.receiver.phone,
      },
      parcels: [{ template: params.parcelSize }],
      custom_attributes: {
        target_point: params.targetPoint,
        sending_method: "dispatch_order",
      },
      service: "inpost_locker_standard",
      reference: params.reference,
      external_customer_id: params.organizationId,
    };

    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `[InPostClient] createShipment failed: HTTP ${response.status} — ${errorBody}`,
      );
    }

    const json = await response.json();
    const parsed = shipxCreateResponseSchema.parse(json);

    return {
      externalId: String(parsed.id),
      trackingNumber: parsed.tracking_number,
      status: parsed.status,
      labelUrl: parsed.href ? `${parsed.href}/label` : undefined,
    };
  }

  /**
   * Download shipment label as PDF or ZPL.
   *
   * GET /v1/shipments/{id}/label
   */
  async getLabel(
    shipmentExternalId: string,
    format: LabelFormat = "pdf",
  ): Promise<Buffer> {
    const url = `${this.baseUrl}/v1/shipments/${shipmentExternalId}/label`;
    const accept =
      format === "zpl" ? "application/zpl" : "application/pdf";

    const response = await globalThis.fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: accept,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `[InPostClient] getLabel failed: HTTP ${response.status} — ${errorBody}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get current shipment status from ShipX.
   *
   * GET /v1/shipments/{id}
   */
  async getStatus(shipmentExternalId: string): Promise<CourierStatusResult> {
    const url = `${this.baseUrl}/v1/shipments/${shipmentExternalId}`;

    const response = await globalThis.fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `[InPostClient] getStatus failed: HTTP ${response.status} — ${errorBody}`,
      );
    }

    const json = await response.json();
    const parsed = shipxStatusResponseSchema.parse(json);

    return {
      externalId: String(parsed.id),
      status: parsed.status,
      trackingNumber: parsed.tracking_number,
      updatedAt: parsed.updated_at,
    };
  }

  /**
   * Cancel a shipment via ShipX.
   *
   * DELETE /v1/shipments/{id}
   */
  async cancelShipment(shipmentExternalId: string): Promise<void> {
    const url = `${this.baseUrl}/v1/shipments/${shipmentExternalId}`;

    const response = await globalThis.fetch(url, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `[InPostClient] cancelShipment failed: HTTP ${response.status} — ${errorBody}`,
      );
    }
  }
}
