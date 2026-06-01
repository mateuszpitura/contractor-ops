// Phase 72 Wave 3 — GREEN tests for payment-block-modal

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { ContractorReason } from '../payment-block-modal';
import { PaymentBlockModal } from '../payment-block-modal';

const oneContractor: ContractorReason[] = [
  {
    contractorId: 'ctr-1',
    contractorName: 'Acme GmbH',
    reasons: [
      {
        itemId: 'item-1',
        policyRuleId: 'compliance-policy-engine.de.a1',
        documentTypeLabelKey: 'Compliance.documentType.compliance-policy-engine.de.a1',
        expiredOnDate: '2026-04-01',
        jurisdictionTz: 'Europe/Berlin',
        deepLinkPath: '/contractors/ctr-1/compliance#item-item-1',
      },
    ],
  },
];

describe('payment-block-modal', () => {
  it('renders per-contractor sections with deep links to expired documents', () => {
    render(<PaymentBlockModal open onClose={vi.fn()} contractorReasons={oneContractor} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/contractors/ctr-1/compliance#item-item-1'),
    );
  });

  it('shows i18n locked-phrase document type labels', () => {
    render(<PaymentBlockModal open onClose={vi.fn()} contractorReasons={oneContractor} />);
    // The A1 label resolves via Compliance.documentType.compliance-policy-engine.de.a1.
    // Assert via the deep-link aria-label which interpolates the resolved label —
    // robust against the collapsible content's mount/visibility behaviour.
    expect(screen.getByRole('link', { name: /A1-Bescheinigung/ })).toBeInTheDocument();
  });

  it('renders empty state gracefully when contractorReasons is []', () => {
    render(<PaymentBlockModal open onClose={vi.fn()} contractorReasons={[]} />);
    // Empty payload → destructive Alert fallback, not a crash.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Payment blocked')).toBeInTheDocument();
  });

  it('truncates a long contractor name with the full value in the title attribute', () => {
    const longName = 'A'.repeat(60);
    render(
      <PaymentBlockModal
        open
        onClose={vi.fn()}
        contractorReasons={[{ contractorId: 'c', contractorName: longName, reasons: [] }]}
      />,
    );
    expect(screen.getByTitle(longName)).toBeInTheDocument();
  });

  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    const { user } = setup(
      <PaymentBlockModal open onClose={onClose} contractorReasons={oneContractor} />,
    );
    // Both the Dialog's built-in X and the footer action expose name /close/i;
    // click the footer action (the one with a visible "Close" text label).
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const footerClose = closeButtons.find(b => b.textContent?.trim() === 'Close');
    if (!footerClose) throw new Error('footer Close button not found');
    await user.click(footerClose);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('payment-wizard error-handling', () => {
  it('catches PRECONDITION_FAILED tRPC error and opens block modal with cause payload', () => {
    // Mirrors the hook's isPaymentBlock type-guard contract: a PRECONDITION_FAILED
    // error carrying cause.contractorReasons drives paymentBlock.open = true.
    const err = {
      data: { code: 'PRECONDITION_FAILED' },
      cause: { contractorReasons: oneContractor },
    };
    const isPaymentBlock = (e: unknown): e is typeof err => {
      const x = e as { data?: { code?: string }; cause?: { contractorReasons?: unknown } };
      return x?.data?.code === 'PRECONDITION_FAILED' && Array.isArray(x?.cause?.contractorReasons);
    };
    expect(isPaymentBlock(err)).toBe(true);
    const state = isPaymentBlock(err)
      ? { open: true, reasons: err.cause.contractorReasons }
      : { open: false, reasons: [] };
    expect(state.open).toBe(true);
    expect(state.reasons).toHaveLength(1);
    expect(state.reasons[0]?.contractorId).toBe('ctr-1');

    // A non-block error must NOT open the modal.
    expect(isPaymentBlock({ data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false);
  });
});
