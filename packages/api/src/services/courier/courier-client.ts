// ---------------------------------------------------------------------------
// CourierClient Interface
//
// Abstract interface for courier integrations (InPost now, DPD/UPS in Phase 35).
// Separate bounded context from BaseAdapter (per STATE.md decision).
// ---------------------------------------------------------------------------

/**
 * Generic courier client interface that all carrier implementations must satisfy.
 */
export interface CourierClient {
  createShipment(params: CreateShipmentParams): Promise<CourierShipmentResult>;
  getLabel(shipmentExternalId: string, format: LabelFormat): Promise<Buffer>;
  getStatus(shipmentExternalId: string): Promise<CourierStatusResult>;
  cancelShipment(shipmentExternalId: string): Promise<void>;
}

/**
 * Parameters for creating a shipment via any courier provider.
 */
export interface CreateShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string };
  sender: { name: string; email: string; phone: string };
  targetPoint: string; // Paczkomat ID (e.g., "KRA012")
  parcelSize: "small" | "medium" | "large";
  reference?: string;
}

/**
 * Result of creating a shipment.
 */
export interface CourierShipmentResult {
  externalId: string;
  trackingNumber: string;
  status: string;
  labelUrl?: string;
}

/**
 * Result of querying shipment status.
 */
export interface CourierStatusResult {
  externalId: string;
  status: string;
  trackingNumber?: string;
  updatedAt?: string;
}

/**
 * Supported label formats.
 */
export type LabelFormat = "pdf" | "zpl";

// ---------------------------------------------------------------------------
// Address-based carrier params (DPD, UPS)
// ---------------------------------------------------------------------------

/** Delivery address for DPD/UPS shipments. */
export interface DeliveryAddress {
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

/** Sender with full address (required by address-based carriers). */
export interface AddressSender {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

/** Base shipment params shared by address-based carriers (DPD, UPS). */
export interface AddressShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string };
  sender: AddressSender;
  parcelSize: "small" | "medium" | "large";
  reference?: string;
  deliveryAddress: DeliveryAddress;
}

/** DPD-specific shipment params. */
export interface DPDShipmentParams extends AddressShipmentParams {}

/** UPS-specific shipment params. */
export interface UPSShipmentParams extends AddressShipmentParams {
  serviceCode: string; // "11" Standard, "65" Saver, "07" Express
}
