// ---------------------------------------------------------------------------
// CourierClient Interface
//
// Abstract interface for courier integrations (InPost now, DPD/UPS in Phase 35).
// Separate bounded context from BaseAdapter (per STATE.md decision).
// ---------------------------------------------------------------------------

/**
 * Generic courier client interface that all carrier implementations must satisfy.
 */
/** Union of all shipment param types accepted by courier clients. */
export type ShipmentParams =
  | BaseShipmentParams
  | InPostShipmentParams
  | AddressShipmentParams
  | DPDShipmentParams
  | UPSShipmentParams;

export interface CourierClient {
  createShipment(params: ShipmentParams): Promise<CourierShipmentResult>;
  getLabel(shipmentExternalId: string, format: LabelFormat): Promise<Buffer>;
  getStatus(shipmentExternalId: string): Promise<CourierStatusResult>;
  cancelShipment(shipmentExternalId: string): Promise<void>;
}

/**
 * Base shipment parameters shared by all courier providers.
 * Carrier-specific params extend this interface with additional fields.
 */
export interface BaseShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string };
  sender: { name: string; email: string; phone: string };
  parcelSize: "small" | "medium" | "large";
  reference?: string;
}

/**
 * InPost-specific shipment params with Paczkomat target point.
 */
export interface InPostShipmentParams extends BaseShipmentParams {
  targetPoint: string; // Paczkomat ID (e.g., "KRA012")
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

/** Address-based shipment params for carriers that deliver to street addresses (DPD, UPS). */
export interface AddressShipmentParams extends Omit<BaseShipmentParams, "sender"> {
  sender: AddressSender;
  deliveryAddress: DeliveryAddress;
}

/** DPD-specific shipment params. */
export interface DPDShipmentParams extends AddressShipmentParams {}

/** UPS-specific shipment params. */
export interface UPSShipmentParams extends AddressShipmentParams {
  serviceCode: string; // "11" Standard, "65" Saver, "07" Express
}
