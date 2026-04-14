import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { setup, render, screen } from '@/test/test-utils';

import { EInvoiceComplianceSummaryTile } from '../einvoice-compliance-summary-tile';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    einvoice: {
      summaryForOrg: {
        queryOptions: () => ({ queryKey: ['einvoice', 'summaryForOrg'] }),
      },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('EInvoiceComplianceSummaryTile', () => {
  it('renders skeletons while loading', () => {
    mockedUseQuery.mockReturnValue({ isLoading: true, data: undefined } as ReturnType<
      typeof useQuery
    >);
    render(<EInvoiceComplianceSummaryTile />);
    // No KPI rendered yet
    expect(screen.queryByTestId('einvoice-compliance-kpi')).not.toBeInTheDocument();
  });

  it('renders percentage + body + hides Review CTA when invalid+failed = 0', () => {
    mockedUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        total: 100,
        notGenerated: 10,
        valid: 70,
        warnings: 14,
        invalid: 0,
        transmitted: 60,
        failed: 0,
      },
    } as ReturnType<typeof useQuery>);

    render(<EInvoiceComplianceSummaryTile />);

    expect(screen.getByTestId('einvoice-compliance-kpi')).toHaveTextContent('84%');
    expect(
      screen.getByText(/84 of 100 invoices are EN 16931 compliant\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
  });

  it('shows Review CTA when needs-attention > 0 and fires callback', async () => {
    mockedUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        total: 100,
        notGenerated: 10,
        valid: 50,
        warnings: 10,
        invalid: 20,
        transmitted: 45,
        failed: 10,
      },
    } as ReturnType<typeof useQuery>);

    const onReview = vi.fn();
    const { user } = setup(
      <EInvoiceComplianceSummaryTile onReviewFilterRequested={onReview} />,
    );

    const reviewBtn = screen.getByRole('button', { name: 'Review 30 invoice(s)' });
    await user.click(reviewBtn);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('KPI colour reflects compliance bands (≥95 = primary)', () => {
    mockedUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        total: 100,
        notGenerated: 0,
        valid: 95,
        warnings: 0,
        invalid: 5,
        transmitted: 95,
        failed: 0,
      },
    } as ReturnType<typeof useQuery>);

    render(<EInvoiceComplianceSummaryTile />);
    const kpi = screen.getByTestId('einvoice-compliance-kpi');
    expect(kpi.className).toContain('text-primary');
  });

  it('renders 100% for empty orgs (total=0, no division by zero)', () => {
    mockedUseQuery.mockReturnValue({
      isLoading: false,
      data: {
        total: 0,
        notGenerated: 0,
        valid: 0,
        warnings: 0,
        invalid: 0,
        transmitted: 0,
        failed: 0,
      },
    } as ReturnType<typeof useQuery>);

    render(<EInvoiceComplianceSummaryTile />);
    expect(screen.getByTestId('einvoice-compliance-kpi')).toHaveTextContent('100%');
  });
});
