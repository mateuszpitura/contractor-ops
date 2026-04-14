import type { SvrlIssue } from './svrl-issue-list';

// ---------------------------------------------------------------------------
// Client-side lifecycle shape — matches the projection returned by
// invoice.getById's eInvoiceLifecycle include clause. Kept narrow so
// component code doesn't drift with the full Prisma model.
// ---------------------------------------------------------------------------

export type EInvoiceValidationStatus = 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';

export type EInvoiceTransmissionStatus =
  | 'NOT_SENT'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';

export interface EInvoiceLifecycleEventShape {
  id: string;
  eventType: string;
  createdAt: string | Date;
  detailsJson?: unknown;
}

export interface EInvoiceLifecycleShape {
  id: string;
  validationStatus: EInvoiceValidationStatus;
  transmissionStatus: EInvoiceTransmissionStatus;
  xmlSha256?: string | null;
  ruleSetVersion?: string | null;
  transmissionId?: string | null;
  finalizedAt?: string | Date | null;
  transmittedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  /**
   * Validation report summary (normalised in finalize). Issues may also be
   * fetched separately when the stored report isn't attached to lifecycle.
   */
  validationReportSummary?: {
    status: string;
    ruleSetVersion: string;
    issues: SvrlIssue[];
    perLayer: Array<{
      layer: string;
      status: string;
      errorCount: number;
      warningCount: number;
    }>;
  } | null;
  events: EInvoiceLifecycleEventShape[];
}

export interface PeppolParticipantLike {
  status: 'NOT_REGISTERED' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';
}

export interface InvoiceTabData {
  invoiceId: string;
  lifecycle: EInvoiceLifecycleShape | null;
  peppolParticipant: PeppolParticipantLike | null;
  receiverAcceptsXRechnungCii: boolean;
  leitwegIdValue: string | null;
  leitwegIdSource: 'contract' | 'contractorDefault' | null;
  isPublicSectorBuyer: boolean;
}
