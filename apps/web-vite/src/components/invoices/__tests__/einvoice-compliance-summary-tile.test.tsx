import { render, screen, setup } from '@/test/test-utils';

import {
  EInvoiceComplianceSummaryTileView,
  EInvoiceComplianceSummaryTileSkeleton,
} from '../einvoice-compliance-summary-tile';

describe('EInvoiceComplianceSummaryTile', () => {
  it('skeleton renders without KPI', () => {
    render(<EInvoiceComplianceSummaryTileSkeleton />);
    expect(screen.queryByTestId('einvoice-compliance-kpi')).not.toBeInTheDocument();
  });

  it('renders percentage + body + hides Review CTA when invalid+failed = 0', () => {
    render(
      <EInvoiceComplianceSummaryTileView
        summary={{
          total: 100,
          notGenerated: 10,
          valid: 70,
          warnings: 14,
          invalid: 0,
          transmitted: 60,
          failed: 0,
        }}
      />,
    );

    expect(screen.getByTestId('einvoice-compliance-kpi')).toHaveTextContent('84%');
    expect(screen.getByText(/84 of 100 invoices are EN 16931 compliant\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
  });

  it('shows Review CTA when needs-attention > 0 and fires callback', async () => {
    const onReview = vi.fn();
    const { user } = setup(
      <EInvoiceComplianceSummaryTileView
        onReviewFilterRequested={onReview}
        summary={{
          total: 100,
          notGenerated: 10,
          valid: 50,
          warnings: 10,
          invalid: 20,
          transmitted: 45,
          failed: 10,
        }}
      />,
    );

    const reviewBtn = screen.getByRole('button', { name: 'Review 30 invoice(s)' });
    await user.click(reviewBtn);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('KPI colour reflects compliance bands (>=95 = primary)', () => {
    render(
      <EInvoiceComplianceSummaryTileView
        summary={{
          total: 100,
          notGenerated: 0,
          valid: 95,
          warnings: 0,
          invalid: 5,
          transmitted: 95,
          failed: 0,
        }}
      />,
    );
    const kpi = screen.getByTestId('einvoice-compliance-kpi');
    expect(kpi.className).toContain('text-primary');
  });

  it('renders 100% for empty orgs (total=0, no division by zero)', () => {
    render(
      <EInvoiceComplianceSummaryTileView
        summary={{
          total: 0,
          notGenerated: 0,
          valid: 0,
          warnings: 0,
          invalid: 0,
          transmitted: 0,
          failed: 0,
        }}
      />,
    );
    expect(screen.getByTestId('einvoice-compliance-kpi')).toHaveTextContent('100%');
  });
});
