/**
 * Presentational View tests for the staff 1042-S batch review surface. Covers
 * the four wired states and the two load-bearing invariants: the 30% statutory
 * branch renders an amber advisory caption and never disables the batch action,
 * and the FTIN slot delegates to the gated SsnMaskedReveal (mocked here to keep
 * the View free of the tRPC boundary).
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { Form1042SBatchSummary, Form1042SRecipientRow } from '../hooks/use-1042s-batch.js';
import { Tax1042SBatchPanelView } from '../tax-1042s-batch-panel.js';

vi.mock('../../compliance/ssn-masked-reveal.js', () => ({
  SsnMaskedReveal: ({ last4 }: { last4: string }) => (
    <span data-testid="ssn-masked-reveal">{last4}</span>
  ),
}));

function makeRow(overrides: Partial<Form1042SRecipientRow> = {}): Form1042SRecipientRow {
  return {
    id: 'f-1',
    recipientId: 'c-1',
    recipientName: 'Acme GmbH',
    ftinLast4: '4321',
    status: 'ACTIVE',
    corrected: false,
    treatyArticle: 'Article 7',
    ratePercent: 0,
    grossIncomeMinor: 500000,
    withheldMinor: 0,
    currency: 'USD',
    isStatutory: false,
    ...overrides,
  };
}

const summary: Form1042SBatchSummary = {
  taxYear: 2025,
  recipientCount: 2,
  totalGrossMinor: 900000,
  totalWithheldMinor: 120000,
  currency: 'USD',
};

function baseProps() {
  return {
    taxYear: 2025,
    isPending: false,
    error: null,
    isEmpty: false,
    rows: [] as Form1042SRecipientRow[],
    summary,
    canRevealPii: false,
    isGenerating: false,
    onGenerate: vi.fn(),
    onReload: vi.fn(),
  };
}

describe('Tax1042SBatchPanelView', () => {
  it('shows aria-busy skeletons while loading', () => {
    const { container } = render(<Tax1042SBatchPanelView {...baseProps()} isPending={true} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders an alert and a working reload button on error', async () => {
    const onReload = vi.fn();
    const { user } = setup(
      <Tax1042SBatchPanelView {...baseProps()} error={new Error('boom')} onReload={onReload} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onReload).toHaveBeenCalled();
  });

  it('offers the generate CTA in the empty state', async () => {
    const onGenerate = vi.fn();
    const { user } = setup(
      <Tax1042SBatchPanelView {...baseProps()} isEmpty={true} onGenerate={onGenerate} />,
    );
    const button = screen.getByRole('button');
    await user.click(button);
    expect(onGenerate).toHaveBeenCalled();
  });

  it('renders recipients and the batch summary when loaded', () => {
    render(
      <Tax1042SBatchPanelView
        {...baseProps()}
        rows={[makeRow(), makeRow({ id: 'f-2', recipientId: 'c-2', recipientName: 'Globex Ltd' })]}
      />,
    );
    expect(screen.getByText('Acme GmbH')).toBeInTheDocument();
    expect(screen.getByText('Globex Ltd')).toBeInTheDocument();
    expect(screen.getAllByTestId('ssn-masked-reveal')).toHaveLength(2);
  });

  it('shows an amber statutory caption and never disables the batch action for a missing W-8', () => {
    const { container } = render(
      <Tax1042SBatchPanelView
        {...baseProps()}
        rows={[
          makeRow({
            id: 'f-stat',
            treatyArticle: null,
            ratePercent: 30,
            withheldMinor: 150000,
            isStatutory: true,
          }),
        ]}
      />,
    );
    const caption = container.querySelector('[data-basis="statutory"]');
    expect(caption).toBeInTheDocument();
    expect(caption).toHaveClass('text-warning');
    // The batch/regenerate action stays enabled — the statutory branch is
    // advisory, not a block.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toBeDisabled();
    }
  });

  it('renders a treaty caption in a success tone when a W-8 chain is complete', () => {
    const { container } = render(<Tax1042SBatchPanelView {...baseProps()} rows={[makeRow()]} />);
    const caption = container.querySelector('[data-basis="treaty"]');
    expect(caption).toBeInTheDocument();
    expect(caption).toHaveClass('text-success');
  });
});
