import type { AtelierStatusVariant } from './variants.js';

export type PortalInvoiceStatusInput = {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
};

export type PortalInvoiceStatusDisplay = {
  variant: AtelierStatusVariant;
  /** i18n key under Portal.invoices.status.* */
  labelKey: 'paid' | 'paymentScheduled' | 'approved' | 'rejected' | 'inReview' | 'submitted';
};

/**
 * Composite portal invoice status: payment and approval layers override base status.
 * Containers resolve labelKey through Portal.invoices.status translations.
 */
export function resolvePortalInvoiceStatusDisplay(
  invoice: PortalInvoiceStatusInput,
): PortalInvoiceStatusDisplay {
  if (invoice.paymentStatus === 'PAID') {
    return { labelKey: 'paid', variant: 'success' };
  }
  if (invoice.paymentStatus === 'IN_RUN') {
    return { labelKey: 'paymentScheduled', variant: 'live' };
  }
  if (invoice.approvalStatus === 'APPROVED') {
    return { labelKey: 'approved', variant: 'success' };
  }
  if (invoice.status === 'REJECTED') {
    return { labelKey: 'rejected', variant: 'danger' };
  }
  if (invoice.status === 'UNDER_REVIEW' || invoice.status === 'APPROVAL_PENDING') {
    return { labelKey: 'inReview', variant: 'warning' };
  }
  return { labelKey: 'submitted', variant: 'info' };
}
