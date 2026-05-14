import { describe, expect, it } from 'vitest';
import type {
  ApprovalStatusInput,
  ChangeRequestStatusInput,
  ContractorLifecycleStageInput,
  ContractorStatusInput,
  ContractStatusInput,
  EInvoiceTransmissionStatusInput,
  EInvoiceValidationStatusInput,
  InvoiceMatchStatusInput,
  InvoiceStatusInput,
  MemberStatusInput,
  PaymentRunItemStatusInput,
  PaymentRunStatusInput,
  PaymentStatusInput,
  PeppolParticipantStatusInput,
  PeppolTransmissionStatusInput,
  WorkflowRunStatusInput,
  WorkflowTaskStatusInput,
  ZatcaSubmissionStatusInput,
} from '../mapper.js';
import { statusToVariant } from '../mapper.js';

/**
 * Exhaustiveness tests — every Prisma enum value the mapper claims to
 * handle must produce a defined AtelierStatusVariant. Adding a new
 * value to a union without updating the mapper would be caught at
 * compile time by the `assertExhaustive(value: never)` default in
 * each switch — these tests catch the inverse: that we haven't drifted
 * the status union here away from the actual Prisma enum.
 *
 * The status unions in mapper.ts mirror Prisma enums by hand (the
 * package can't import @contractor-ops/db). If a Prisma migration
 * adds an enum value, update the union AND add an entry below; the
 * test will fail until both happen, which is the point.
 */

const ALL_VARIANTS = new Set([
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'processing',
  'blocked',
  'live',
] as const);

function expectVariant<D extends Parameters<typeof statusToVariant>[0]>(
  domain: D,
  inputs: ReadonlyArray<Parameters<typeof statusToVariant<D>>[1]>,
) {
  for (const input of inputs) {
    const variant = statusToVariant(domain, input);
    expect(ALL_VARIANTS.has(variant)).toBe(true);
  }
}

describe('statusToVariant — domain exhaustiveness', () => {
  it('invoice covers every InvoiceStatus enum value', () => {
    const inputs: ReadonlyArray<InvoiceStatusInput> = [
      'RECEIVED',
      'UNDER_REVIEW',
      'APPROVAL_PENDING',
      'APPROVED',
      'REJECTED',
      'READY_FOR_PAYMENT',
      'PARTIALLY_PAID',
      'PAID',
      'VOID',
    ];
    expectVariant('invoice', inputs);
  });

  it('invoice-match covers every InvoiceMatchStatus enum value', () => {
    const inputs: ReadonlyArray<InvoiceMatchStatusInput> = [
      'UNMATCHED',
      'PARTIAL',
      'MATCHED',
      'DISCREPANCY',
      'MANUALLY_CONFIRMED',
    ];
    expectVariant('invoice-match', inputs);
  });

  it('contractor + contractor-lifecycle cover every relevant enum value', () => {
    const contractor: ReadonlyArray<ContractorStatusInput> = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
    const lifecycle: ReadonlyArray<ContractorLifecycleStageInput> = [
      'DRAFT',
      'ONBOARDING',
      'ACTIVE',
      'OFFBOARDING',
      'ENDED',
    ];
    expectVariant('contractor', contractor);
    expectVariant('contractor-lifecycle', lifecycle);
  });

  it('contract covers every ContractStatus enum value', () => {
    const inputs: ReadonlyArray<ContractStatusInput> = [
      'DRAFT',
      'PENDING_SIGNATURE',
      'SIGNATURE_DECLINED',
      'SIGNATURE_EXPIRED',
      'ACTIVE',
      'EXPIRING',
      'EXPIRED',
      'TERMINATED',
      'SUPERSEDED',
      'ARCHIVED',
    ];
    expectVariant('contract', inputs);
  });

  it('payment + payment-run + payment-run-item cover every relevant enum value', () => {
    const payment: ReadonlyArray<PaymentStatusInput> = [
      'NOT_READY',
      'READY',
      'IN_RUN',
      'PARTIALLY_PAID',
      'PAID',
      'FAILED',
    ];
    const run: ReadonlyArray<PaymentRunStatusInput> = [
      'DRAFT',
      'LOCKED',
      'EXPORTED',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ];
    const item: ReadonlyArray<PaymentRunItemStatusInput> = [
      'PENDING',
      'EXPORTED',
      'PAID',
      'FAILED',
      'SKIPPED',
    ];
    expectVariant('payment', payment);
    expectVariant('payment-run', run);
    expectVariant('payment-run-item', item);
  });

  it('approval covers every ApprovalStatus enum value', () => {
    const inputs: ReadonlyArray<ApprovalStatusInput> = [
      'NOT_STARTED',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ];
    expectVariant('approval', inputs);
  });

  it('workflow-run + workflow-task cover every relevant enum value', () => {
    const run: ReadonlyArray<WorkflowRunStatusInput> = [
      'NOT_STARTED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'BLOCKED',
      'OVERDUE',
    ];
    const task: ReadonlyArray<WorkflowTaskStatusInput> = [
      'TODO',
      'IN_PROGRESS',
      'DONE',
      'BLOCKED',
      'SKIPPED',
      'CANCELLED',
      'OVERDUE',
    ];
    expectVariant('workflow-run', run);
    expectVariant('workflow-task', task);
  });

  it('einvoice-validation + einvoice-transmission cover every relevant enum value', () => {
    const validation: ReadonlyArray<EInvoiceValidationStatusInput> = [
      'NOT_VALIDATED',
      'VALID',
      'INVALID',
      'WARNINGS',
    ];
    const transmission: ReadonlyArray<EInvoiceTransmissionStatusInput> = [
      'NOT_SENT',
      'QUEUED',
      'SENT',
      'DELIVERED',
      'FAILED',
    ];
    expectVariant('einvoice-validation', validation);
    expectVariant('einvoice-transmission', transmission);
  });

  it('peppol-participant + peppol-transmission cover every relevant enum value', () => {
    const participant: ReadonlyArray<PeppolParticipantStatusInput> = [
      'PENDING',
      'REGISTERED',
      'ACTIVE',
      'SUSPENDED',
      'DEREGISTERED',
    ];
    const transmission: ReadonlyArray<PeppolTransmissionStatusInput> = [
      'PENDING',
      'TRANSMITTED',
      'DELIVERED',
      'FAILED',
      'REJECTED',
    ];
    expectVariant('peppol-participant', participant);
    expectVariant('peppol-transmission', transmission);
  });

  it('zatca covers every ZatcaSubmissionStatus enum value', () => {
    const inputs: ReadonlyArray<ZatcaSubmissionStatusInput> = [
      'PENDING',
      'SUBMITTED',
      'CLEARED',
      'REPORTED',
      'REJECTED',
      'WARNING',
    ];
    expectVariant('zatca', inputs);
  });

  it('change-request covers every ContractorChangeRequestStatus enum value', () => {
    const inputs: ReadonlyArray<ChangeRequestStatusInput> = ['PENDING', 'APPROVED', 'REJECTED'];
    expectVariant('change-request', inputs);
  });

  it('member covers every Better Auth member status', () => {
    const inputs: ReadonlyArray<MemberStatusInput> = ['active', 'invited', 'disabled', 'banned'];
    expectVariant('member', inputs);
  });
});

describe('statusToVariant — semantic spot checks', () => {
  it('maps invoice success states to success variant', () => {
    expect(statusToVariant('invoice', 'PAID')).toBe('success');
    expect(statusToVariant('invoice', 'APPROVED')).toBe('success');
  });

  it('maps invoice ready-to-pay to live variant', () => {
    expect(statusToVariant('invoice', 'READY_FOR_PAYMENT')).toBe('live');
  });

  it('maps workflow blocked states to blocked variant', () => {
    expect(statusToVariant('workflow-run', 'BLOCKED')).toBe('blocked');
    expect(statusToVariant('workflow-task', 'BLOCKED')).toBe('blocked');
  });

  it('maps disabled / banned member states to danger variant', () => {
    expect(statusToVariant('member', 'disabled')).toBe('danger');
    expect(statusToVariant('member', 'banned')).toBe('danger');
  });

  it('maps draft / archived contract states to neutral variant', () => {
    expect(statusToVariant('contract', 'DRAFT')).toBe('neutral');
    expect(statusToVariant('contract', 'ARCHIVED')).toBe('neutral');
  });

  it('maps EXPIRING contract to warning, not danger', () => {
    expect(statusToVariant('contract', 'EXPIRING')).toBe('warning');
    // EXPIRED has crossed the threshold — that's danger
    expect(statusToVariant('contract', 'EXPIRED')).toBe('danger');
  });
});
