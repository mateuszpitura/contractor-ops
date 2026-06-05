/**
 * E-invoice tab shared types.
 */

import type { SvrlIssue } from './svrl-issue-list.js';

export type EInvoiceValidationStatus = 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';

export type EInvoiceTransmissionStatus = 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

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
