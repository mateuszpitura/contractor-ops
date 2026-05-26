/**
 * Compatibility re-export of the e-invoice compliance cell so the legacy
 * import path (`@/components/invoices/einvoice-status-cell`) keeps working
 * for consumers that have not yet been codemodded to the new layout.
 *
 * The canonical implementation lives under `invoice-table/` since the
 * table column was the first consumer.
 */

export {
  EInvoiceComplianceCell as EInvoiceStatusCell,
  type EInvoiceComplianceStatus,
} from './invoice-table/einvoice-compliance-cell.js';
