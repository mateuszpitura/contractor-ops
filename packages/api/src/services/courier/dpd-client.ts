import { z } from 'zod';

import type {
  CourierClient,
  CourierShipmentResult,
  CourierStatusResult,
  DPDShipmentParams,
  LabelFormat,
  ShipmentParams,
} from './courier-client.js';

// ---------------------------------------------------------------------------
// DPD Package API Client
//
// Thin HTTP wrapper around the DPD SOAP-like REST API.
// Uses globalThis.fetch for test mockability.
// ---------------------------------------------------------------------------

const DPD_SANDBOX_URL =
  'https://dpdservicesdemo.dpd.com.pl/DPDPackageObjServicesService/DPDPackageObjServices';
const DPD_PRODUCTION_URL =
  'https://dpdservices.dpd.com.pl/DPDPackageObjServicesService/DPDPackageObjServices';

/** Map abstract parcel sizes to DPD physical dimensions (cm) and weight (kg). */
const DPD_SIZE_MAP = {
  small: { weight: 2, sizeX: 30, sizeY: 20, sizeZ: 10 },
  medium: { weight: 5, sizeX: 40, sizeY: 30, sizeZ: 20 },
  large: { weight: 10, sizeX: 60, sizeY: 40, sizeZ: 30 },
} as const;

/** Zod schema for DPD create-shipment response validation. */
const dpdCreateResponseSchema = z.object({
  parcels: z.array(
    z.object({
      id: z.number(),
      waybill: z.string(),
      status: z.string(),
    }),
  ),
});

/** Zod schema for DPD tracking response validation. */
const dpdTrackingResponseSchema = z.object({
  parcelId: z.string(),
  waybill: z.string(),
  status: z.string(),
  eventTimestamp: z.string().optional(),
});

export interface DPDClientConfig {
  username: string;
  password: string;
  fid: string; // DPD sender FID
  sandbox: boolean;
}

export class DPDClient implements CourierClient {
  private readonly username: string;
  private readonly password: string;
  private readonly fid: string;
  private readonly sandbox: boolean;

  constructor(config: DPDClientConfig) {
    this.username = config.username;
    this.password = config.password;
    this.fid = config.fid;
    this.sandbox = config.sandbox;
  }

  private get baseUrl(): string {
    return this.sandbox ? DPD_SANDBOX_URL : DPD_PRODUCTION_URL;
  }

  private get authData() {
    return {
      login: this.username,
      password: this.password,
      masterFid: this.fid,
    };
  }

  /**
   * Create a shipment via DPD Package API.
   *
   * Accepts BaseShipmentParams and narrows to DPDShipmentParams internally.
   */
  async createShipment(params: ShipmentParams): Promise<CourierShipmentResult> {
    if (!('deliveryAddress' in params)) {
      throw new Error('[dpd-client] createShipment requires deliveryAddress for DPD shipments');
    }
    const dpdParams = params as DPDShipmentParams;
    const url = `${this.baseUrl}/createShipment`;
    const size = DPD_SIZE_MAP[dpdParams.parcelSize];

    const body = {
      authData: this.authData,
      parcels: [
        {
          weight: size.weight,
          sizeX: size.sizeX,
          sizeY: size.sizeY,
          sizeZ: size.sizeZ,
          receiver: {
            name: dpdParams.receiver.name,
            email: dpdParams.receiver.email,
            phone: dpdParams.receiver.phone,
            address: {
              street: dpdParams.deliveryAddress.street,
              city: dpdParams.deliveryAddress.city,
              postalCode: dpdParams.deliveryAddress.postalCode,
              countryCode: dpdParams.deliveryAddress.countryCode,
            },
          },
          sender: {
            name: dpdParams.sender.name,
            email: dpdParams.sender.email,
            phone: dpdParams.sender.phone,
            fid: this.fid,
            address: {
              street: dpdParams.sender.street,
              city: dpdParams.sender.city,
              postalCode: dpdParams.sender.postalCode,
              countryCode: dpdParams.sender.countryCode,
            },
          },
          reference: dpdParams.reference ?? '',
        },
      ],
    };

    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`[dpd-client] createShipment failed: HTTP ${response.status} — ${errorBody}`);
    }

    const json = await response.json();
    const parsed = dpdCreateResponseSchema.parse(json);
    const parcel = parsed.parcels[0];

    return {
      externalId: String(parcel.id),
      trackingNumber: parcel.waybill,
      status: parcel.status,
    };
  }

  /**
   * Download shipment label as PDF.
   *
   * GET /label/{waybill}
   */
  async getLabel(shipmentExternalId: string, _format: LabelFormat = 'pdf'): Promise<Buffer> {
    const url = `${this.baseUrl}/label/${shipmentExternalId}`;

    const response = await globalThis.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/pdf' },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`[dpd-client] getLabel failed: HTTP ${response.status} — ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get current shipment status from DPD tracking.
   *
   * GET /tracking/{parcelId}
   */
  async getStatus(shipmentExternalId: string): Promise<CourierStatusResult> {
    const url = `${this.baseUrl}/tracking/${shipmentExternalId}`;

    const response = await globalThis.fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`[dpd-client] getStatus failed: HTTP ${response.status} — ${errorBody}`);
    }

    const json = await response.json();
    const parsed = dpdTrackingResponseSchema.parse(json);

    return {
      externalId: parsed.parcelId,
      status: parsed.status,
      trackingNumber: parsed.waybill,
      updatedAt: parsed.eventTimestamp,
    };
  }

  /**
   * Cancel a shipment via DPD API.
   *
   * POST /cancel/{parcelId}
   */
  async cancelShipment(shipmentExternalId: string): Promise<void> {
    const url = `${this.baseUrl}/cancel/${shipmentExternalId}`;

    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authData: this.authData }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`[dpd-client] cancelShipment failed: HTTP ${response.status} — ${errorBody}`);
    }
  }
}
