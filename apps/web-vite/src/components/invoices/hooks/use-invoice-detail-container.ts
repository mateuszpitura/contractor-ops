import { useDuplicateWarning } from './use-duplicate-warning.js';
import { useInvoiceDetail } from './use-invoice-detail.js';
import { usePeppolStatusBadge } from './use-peppol-status-badge.js';

interface InvoiceFlagsShape {
  status: string;
  source: string;
  matchStatus: string | null;
  externalInvoiceId: string | null;
  sourceReference: string | null;
  flagsJson: unknown;
  matchResults?: Array<{ explanationJson: unknown }>;
}

const APPROVAL_STATUSES = new Set(['APPROVAL_PENDING', 'APPROVED', 'REJECTED']);
const SUBMIT_BLOCKED_STATUSES = new Set([
  'APPROVAL_PENDING',
  'APPROVED',
  'REJECTED',
  'READY_FOR_PAYMENT',
  'PAID',
]);

/** Pure derivation: KSEF / Peppol / duplicate / approval flags from invoice payload. */
export function deriveInvoiceFlags(invoice: InvoiceFlagsShape) {
  const flagsArray: string[] = Array.isArray(invoice.flagsJson) ? invoice.flagsJson : [];
  const hasDuplicateFlag = flagsArray.includes('DUPLICATE_SUSPECTED');

  const latestMatchResult = invoice.matchResults?.[0];
  const explanationJson = latestMatchResult?.explanationJson as Record<string, unknown> | null;
  const duplicateInvoiceId = (explanationJson?.duplicateInvoiceId as string) ?? null;

  const isKsefSource = invoice.source === 'KSEF';
  const ksefReference = invoice.externalInvoiceId;
  const ksefUpoReceipt = invoice.sourceReference;
  const isPeppolSource = invoice.source === 'PEPPOL';

  const flagsObj =
    typeof invoice.flagsJson === 'object' &&
    invoice.flagsJson !== null &&
    !Array.isArray(invoice.flagsJson)
      ? (invoice.flagsJson as Record<string, unknown>)
      : null;
  const hasKsefDuplicate = flagsObj?.duplicateSource === 'KSEF';
  const ksefDuplicateId = (flagsObj?.duplicateOf as string) ?? null;

  const hasApprovalFlow = APPROVAL_STATUSES.has(invoice.status);

  const canSubmitForApproval =
    (invoice.matchStatus === 'MATCHED' || invoice.matchStatus === 'MANUALLY_CONFIRMED') &&
    !SUBMIT_BLOCKED_STATUSES.has(invoice.status);

  return {
    hasDuplicateFlag,
    duplicateInvoiceId,
    isKsefSource,
    ksefReference,
    ksefUpoReceipt,
    isPeppolSource,
    hasKsefDuplicate,
    ksefDuplicateId,
    hasApprovalFlow,
    canSubmitForApproval,
  } as const;
}

export function useInvoiceDetailContainer(invoiceId: string, breadcrumbId?: string) {
  const detail = useInvoiceDetail(invoiceId, breadcrumbId);
  const duplicateDismiss = useDuplicateWarning(invoiceId, detail.handleInvoiceInvalidate);
  const { transmission: peppolBadgeTransmission } = usePeppolStatusBadge(invoiceId);

  const invoiceFlags = detail.invoice ? deriveInvoiceFlags(detail.invoice) : null;

  return {
    ...detail,
    duplicateDismiss,
    peppolBadgeTransmission,
    invoiceFlags,
  } as const;
}
