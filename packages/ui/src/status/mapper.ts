/**
 * Domain-aware status → AtelierStatusVariant mapping.
 *
 * The string literal types here mirror the Prisma enums in
 * packages/db/src/generated/prisma/client/enums.ts. We don't import the
 * Prisma types directly because @contractor-ops/ui must stay free of
 * server-runtime deps (it's a client-side package), but the unions are
 * structurally compatible — TypeScript will catch drift at the call site.
 *
 * Adding a new enum value requires updating the corresponding mapper
 * function below. The `assertExhaustive(value)` default makes TS error
 * if a case is missed, so this is provably exhaustive.
 */

import type { AtelierStatusVariant } from './variants.js';
import { assertExhaustive } from './variants.js';

// ─── Invoice ────────────────────────────────────────────────────────────

export type InvoiceStatusInput =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'READY_FOR_PAYMENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'VOID';

function invoiceVariant(status: InvoiceStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'RECEIVED':
      return 'processing';
    case 'UNDER_REVIEW':
    case 'APPROVAL_PENDING':
      return 'info';
    case 'APPROVED':
    case 'PAID':
      return 'success';
    case 'READY_FOR_PAYMENT':
      return 'live';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    case 'VOID':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Invoice match ─────────────────────────────────────────────────────

export type InvoiceMatchStatusInput =
  | 'UNMATCHED'
  | 'PARTIAL'
  | 'MATCHED'
  | 'DISCREPANCY'
  | 'MANUALLY_CONFIRMED';

function invoiceMatchVariant(status: InvoiceMatchStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'MATCHED':
    case 'MANUALLY_CONFIRMED':
      return 'success';
    case 'PARTIAL':
    case 'UNMATCHED':
      return 'warning';
    case 'DISCREPANCY':
      return 'danger';
    default:
      return assertExhaustive(status);
  }
}

// ─── Contractor ────────────────────────────────────────────────────────

export type ContractorStatusInput = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

function contractorVariant(status: ContractorStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
    case 'ARCHIVED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Contractor lifecycle ──────────────────────────────────────────────

export type ContractorLifecycleStageInput =
  | 'DRAFT'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'OFFBOARDING'
  | 'ENDED';

function contractorLifecycleVariant(status: ContractorLifecycleStageInput): AtelierStatusVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'ONBOARDING':
    case 'OFFBOARDING':
      return 'processing';
    case 'DRAFT':
    case 'ENDED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Contract ──────────────────────────────────────────────────────────

export type ContractStatusInput =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNATURE_DECLINED'
  | 'SIGNATURE_EXPIRED'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

function contractVariant(status: ContractStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING_SIGNATURE':
      return 'info';
    case 'EXPIRING':
      return 'warning';
    case 'EXPIRED':
    case 'SIGNATURE_DECLINED':
    case 'SIGNATURE_EXPIRED':
    case 'TERMINATED':
      return 'danger';
    case 'DRAFT':
    case 'SUPERSEDED':
    case 'ARCHIVED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Payment ───────────────────────────────────────────────────────────

export type PaymentStatusInput =
  | 'NOT_READY'
  | 'READY'
  | 'IN_RUN'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'FAILED';

function paymentVariant(status: PaymentStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'READY':
      return 'live';
    case 'IN_RUN':
      return 'processing';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'FAILED':
      return 'danger';
    case 'NOT_READY':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Payment run ───────────────────────────────────────────────────────

export type PaymentRunStatusInput =
  | 'DRAFT'
  | 'LOCKED'
  | 'EXPORTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

function paymentRunVariant(status: PaymentRunStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'LOCKED':
    case 'EXPORTED':
      return 'processing';
    case 'FAILED':
      return 'danger';
    case 'DRAFT':
    case 'CANCELLED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Payment run item ──────────────────────────────────────────────────

export type PaymentRunItemStatusInput = 'PENDING' | 'EXPORTED' | 'PAID' | 'FAILED' | 'SKIPPED';

function paymentRunItemVariant(status: PaymentRunItemStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'info';
    case 'EXPORTED':
      return 'processing';
    case 'FAILED':
      return 'danger';
    case 'SKIPPED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Approval ──────────────────────────────────────────────────────────

export type ApprovalStatusInput = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

function approvalVariant(status: ApprovalStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING':
      return 'info';
    case 'REJECTED':
      return 'danger';
    case 'NOT_STARTED':
    case 'CANCELLED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Workflow run ──────────────────────────────────────────────────────

export type WorkflowRunStatusInput =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'OVERDUE';

function workflowRunVariant(status: WorkflowRunStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'processing';
    case 'OVERDUE':
      return 'warning';
    case 'BLOCKED':
      return 'blocked';
    case 'NOT_STARTED':
    case 'CANCELLED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Workflow task ─────────────────────────────────────────────────────

export type WorkflowTaskStatusInput =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'OVERDUE';

function workflowTaskVariant(status: WorkflowTaskStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'DONE':
      return 'success';
    case 'IN_PROGRESS':
      return 'processing';
    case 'OVERDUE':
      return 'warning';
    case 'BLOCKED':
      return 'blocked';
    case 'TODO':
    case 'SKIPPED':
    case 'CANCELLED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── EInvoice validation ───────────────────────────────────────────────

export type EInvoiceValidationStatusInput = 'NOT_VALIDATED' | 'VALID' | 'INVALID' | 'WARNINGS';

function einvoiceValidationVariant(status: EInvoiceValidationStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'VALID':
      return 'success';
    case 'WARNINGS':
      return 'warning';
    case 'INVALID':
      return 'danger';
    case 'NOT_VALIDATED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── EInvoice transmission ─────────────────────────────────────────────

export type EInvoiceTransmissionStatusInput =
  | 'NOT_SENT'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';

function einvoiceTransmissionVariant(
  status: EInvoiceTransmissionStatusInput,
): AtelierStatusVariant {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'SENT':
      return 'live';
    case 'QUEUED':
      return 'processing';
    case 'FAILED':
      return 'danger';
    case 'NOT_SENT':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Peppol participant ───────────────────────────────────────────────

export type PeppolParticipantStatusInput =
  | 'PENDING'
  | 'REGISTERED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEREGISTERED';

function peppolParticipantVariant(status: PeppolParticipantStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'ACTIVE':
    case 'REGISTERED':
      return 'success';
    case 'PENDING':
      return 'info';
    case 'SUSPENDED':
      return 'blocked';
    case 'DEREGISTERED':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Peppol transmission ──────────────────────────────────────────────

export type PeppolTransmissionStatusInput =
  | 'PENDING'
  | 'TRANSMITTED'
  | 'DELIVERED'
  | 'FAILED'
  | 'REJECTED';

function peppolTransmissionVariant(status: PeppolTransmissionStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'TRANSMITTED':
      return 'live';
    case 'PENDING':
      return 'processing';
    case 'FAILED':
    case 'REJECTED':
      return 'danger';
    default:
      return assertExhaustive(status);
  }
}

// ─── ZATCA ─────────────────────────────────────────────────────────────

export type ZatcaSubmissionStatusInput =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CLEARED'
  | 'REPORTED'
  | 'REJECTED'
  | 'WARNING';

function zatcaVariant(status: ZatcaSubmissionStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'CLEARED':
    case 'REPORTED':
      return 'success';
    case 'WARNING':
      return 'warning';
    case 'SUBMITTED':
      return 'processing';
    case 'REJECTED':
      return 'danger';
    case 'PENDING':
      return 'neutral';
    default:
      return assertExhaustive(status);
  }
}

// ─── Change request (contractor self-service) ─────────────────────────

export type ChangeRequestStatusInput = 'PENDING' | 'APPROVED' | 'REJECTED';

function changeRequestVariant(status: ChangeRequestStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return assertExhaustive(status);
  }
}

// ─── Member / user (Better Auth, lowercase) ────────────────────────────

export type MemberStatusInput = 'active' | 'invited' | 'disabled' | 'banned';

function memberVariant(status: MemberStatusInput): AtelierStatusVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'invited':
      return 'info';
    case 'disabled':
    case 'banned':
      return 'danger';
    default:
      return assertExhaustive(status);
  }
}

// ─── Domain dispatcher ─────────────────────────────────────────────────

/**
 * Domain → status-input map. The Domain literal type is the public API;
 * the per-domain status type is enforced at the call site via the
 * generic `S extends StatusInputFor<D>` constraint on statusToVariant.
 */
export type StatusDomainMap = {
  invoice: InvoiceStatusInput;
  'invoice-match': InvoiceMatchStatusInput;
  contractor: ContractorStatusInput;
  'contractor-lifecycle': ContractorLifecycleStageInput;
  contract: ContractStatusInput;
  payment: PaymentStatusInput;
  'payment-run': PaymentRunStatusInput;
  'payment-run-item': PaymentRunItemStatusInput;
  approval: ApprovalStatusInput;
  'workflow-run': WorkflowRunStatusInput;
  'workflow-task': WorkflowTaskStatusInput;
  'einvoice-validation': EInvoiceValidationStatusInput;
  'einvoice-transmission': EInvoiceTransmissionStatusInput;
  'peppol-participant': PeppolParticipantStatusInput;
  'peppol-transmission': PeppolTransmissionStatusInput;
  zatca: ZatcaSubmissionStatusInput;
  'change-request': ChangeRequestStatusInput;
  member: MemberStatusInput;
};

export type StatusDomain = keyof StatusDomainMap;

/**
 * Map a domain + status to a semantic variant. TypeScript narrows the
 * accepted `status` type by the `domain` literal, so e.g.
 *   statusToVariant('invoice', 'BLOCKED')
 * fails at compile time because BLOCKED is not an InvoiceStatus.
 *
 * Usage:
 *   <AtelierStatusPill variant={statusToVariant('invoice', invoice.status)}>
 *     {invoice.status}
 *   </AtelierStatusPill>
 */
export function statusToVariant<D extends StatusDomain>(
  domain: D,
  status: StatusDomainMap[D],
): AtelierStatusVariant {
  // UI hot path must NEVER crash if the backend adds a new enum value
  // before this mapper is updated. The per-domain mappers retain
  // compile-time exhaustiveness via `assertExhaustive`, but at runtime we
  // catch and degrade to `neutral` so the page still renders.
  try {
    return resolveStatusVariant(domain, status);
  } catch {
    return 'neutral';
  }
}

function resolveStatusVariant<D extends StatusDomain>(
  domain: D,
  status: StatusDomainMap[D],
): AtelierStatusVariant {
  switch (domain) {
    case 'invoice':
      return invoiceVariant(status as InvoiceStatusInput);
    case 'invoice-match':
      return invoiceMatchVariant(status as InvoiceMatchStatusInput);
    case 'contractor':
      return contractorVariant(status as ContractorStatusInput);
    case 'contractor-lifecycle':
      return contractorLifecycleVariant(status as ContractorLifecycleStageInput);
    case 'contract':
      return contractVariant(status as ContractStatusInput);
    case 'payment':
      return paymentVariant(status as PaymentStatusInput);
    case 'payment-run':
      return paymentRunVariant(status as PaymentRunStatusInput);
    case 'payment-run-item':
      return paymentRunItemVariant(status as PaymentRunItemStatusInput);
    case 'approval':
      return approvalVariant(status as ApprovalStatusInput);
    case 'workflow-run':
      return workflowRunVariant(status as WorkflowRunStatusInput);
    case 'workflow-task':
      return workflowTaskVariant(status as WorkflowTaskStatusInput);
    case 'einvoice-validation':
      return einvoiceValidationVariant(status as EInvoiceValidationStatusInput);
    case 'einvoice-transmission':
      return einvoiceTransmissionVariant(status as EInvoiceTransmissionStatusInput);
    case 'peppol-participant':
      return peppolParticipantVariant(status as PeppolParticipantStatusInput);
    case 'peppol-transmission':
      return peppolTransmissionVariant(status as PeppolTransmissionStatusInput);
    case 'zatca':
      return zatcaVariant(status as ZatcaSubmissionStatusInput);
    case 'change-request':
      return changeRequestVariant(status as ChangeRequestStatusInput);
    case 'member':
      return memberVariant(status as MemberStatusInput);
    default:
      return assertExhaustive(domain);
  }
}
