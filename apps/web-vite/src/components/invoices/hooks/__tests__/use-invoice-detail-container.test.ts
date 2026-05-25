/**
 * Pure-derivation coverage for `deriveInvoiceFlags` exported alongside
 * `useInvoiceDetailContainer`. The hook itself wires query + side-effects
 * which are covered indirectly via `use-duplicate-warning` + `use-invoice-detail`
 * specs; this file pins the flag-derivation contract (KSEF / Peppol /
 * approval / duplicate / submit-blocking) so a regression here surfaces fast.
 */

import { describe, expect, it } from 'vitest';

import { deriveInvoiceFlags } from '../use-invoice-detail-container.js';

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    status: 'RECEIVED',
    source: 'MANUAL_UPLOAD',
    matchStatus: 'UNMATCHED',
    externalInvoiceId: null,
    sourceReference: null,
    flagsJson: null,
    matchResults: undefined,
    ...overrides,
  } as Parameters<typeof deriveInvoiceFlags>[0];
}

describe('deriveInvoiceFlags', () => {
  it('defaults — no duplicate, not KSEF, not Peppol, no approval flow, cannot submit', () => {
    const flags = deriveInvoiceFlags(baseInvoice());
    expect(flags.hasDuplicateFlag).toBe(false);
    expect(flags.duplicateInvoiceId).toBeNull();
    expect(flags.isKsefSource).toBe(false);
    expect(flags.isPeppolSource).toBe(false);
    expect(flags.hasKsefDuplicate).toBe(false);
    expect(flags.ksefDuplicateId).toBeNull();
    expect(flags.hasApprovalFlow).toBe(false);
    expect(flags.canSubmitForApproval).toBe(false);
  });

  it('flagsJson array containing DUPLICATE_SUSPECTED → hasDuplicateFlag true', () => {
    const flags = deriveInvoiceFlags(
      baseInvoice({
        flagsJson: ['DUPLICATE_SUSPECTED'],
        matchResults: [{ explanationJson: { duplicateInvoiceId: 'inv_42' } }],
      }),
    );
    expect(flags.hasDuplicateFlag).toBe(true);
    expect(flags.duplicateInvoiceId).toBe('inv_42');
  });

  it('source KSEF surfaces reference + upo receipt', () => {
    const flags = deriveInvoiceFlags(
      baseInvoice({
        source: 'KSEF',
        externalInvoiceId: 'KSEF-1',
        sourceReference: 'UPO-receipt-payload',
      }),
    );
    expect(flags.isKsefSource).toBe(true);
    expect(flags.ksefReference).toBe('KSEF-1');
    expect(flags.ksefUpoReceipt).toBe('UPO-receipt-payload');
  });

  it('flagsJson object with duplicateSource=KSEF → hasKsefDuplicate', () => {
    const flags = deriveInvoiceFlags(
      baseInvoice({
        flagsJson: { duplicateSource: 'KSEF', duplicateOf: 'inv_dup_99' },
      }),
    );
    expect(flags.hasKsefDuplicate).toBe(true);
    expect(flags.ksefDuplicateId).toBe('inv_dup_99');
  });

  it('source PEPPOL surfaces isPeppolSource', () => {
    const flags = deriveInvoiceFlags(baseInvoice({ source: 'PEPPOL' }));
    expect(flags.isPeppolSource).toBe(true);
  });

  it.each([
    ['APPROVAL_PENDING', true],
    ['APPROVED', true],
    ['REJECTED', true],
    ['RECEIVED', false],
    ['PAID', false],
  ])('status %s → hasApprovalFlow=%s', (status, expected) => {
    const flags = deriveInvoiceFlags(baseInvoice({ status }));
    expect(flags.hasApprovalFlow).toBe(expected);
  });

  it('canSubmitForApproval — MATCHED + non-blocked status', () => {
    const flags = deriveInvoiceFlags(
      baseInvoice({ status: 'UNDER_REVIEW', matchStatus: 'MATCHED' }),
    );
    expect(flags.canSubmitForApproval).toBe(true);
  });

  it('canSubmitForApproval — MANUALLY_CONFIRMED + non-blocked status', () => {
    const flags = deriveInvoiceFlags(
      baseInvoice({ status: 'RECEIVED', matchStatus: 'MANUALLY_CONFIRMED' }),
    );
    expect(flags.canSubmitForApproval).toBe(true);
  });

  it.each([
    'APPROVAL_PENDING',
    'APPROVED',
    'REJECTED',
    'READY_FOR_PAYMENT',
    'PAID',
  ])('canSubmitForApproval blocked when status=%s', status => {
    const flags = deriveInvoiceFlags(baseInvoice({ status, matchStatus: 'MATCHED' }));
    expect(flags.canSubmitForApproval).toBe(false);
  });

  it('canSubmitForApproval false when matchStatus is not matched', () => {
    const flags = deriveInvoiceFlags(baseInvoice({ status: 'RECEIVED', matchStatus: 'UNMATCHED' }));
    expect(flags.canSubmitForApproval).toBe(false);
  });

  it('tolerates malformed flagsJson (string) — falls back to defaults', () => {
    const flags = deriveInvoiceFlags(baseInvoice({ flagsJson: 'not-json' }));
    expect(flags.hasDuplicateFlag).toBe(false);
    expect(flags.hasKsefDuplicate).toBe(false);
  });
});
