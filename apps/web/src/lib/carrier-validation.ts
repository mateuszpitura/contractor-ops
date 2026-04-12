/**
 * Validates carrier-specific shipment form fields.
 */

export function isCarrierFormValid(carrier: string, formData: Record<string, unknown>): boolean {
  if (!carrier) return false;

  switch (carrier) {
    case 'inpost':
      return !!formData.selectedPoint;
    case 'dpd': {
      const address = formData.address as
        | { street: string; city: string; postalCode: string }
        | undefined;
      if (!address) return false;
      return !!(address.street.trim() && address.city.trim() && address.postalCode.trim());
    }
    case 'ups': {
      const addr = formData.address as
        | { street: string; city: string; postalCode: string }
        | undefined;
      if (!addr) return false;
      return !!(
        addr.street.trim() &&
        addr.city.trim() &&
        addr.postalCode.trim() &&
        formData.serviceCode
      );
    }
    default:
      return false;
  }
}
