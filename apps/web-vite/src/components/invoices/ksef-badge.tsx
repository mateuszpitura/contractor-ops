/**
 * Re-export of the KSeF source badge so callers can import from the legacy
 * top-level path (`@/components/invoices/ksef-badge`). The canonical
 * implementation lives under `invoice-table/` because the table column was
 * the first consumer.
 */

export { KsefSourceBadge } from './invoice-table/ksef-source-badge.js';
