import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: mockUseQuery };
});

import { ZatcaComplianceWidget } from '../zatca-compliance-widget';

describe('ZatcaComplianceWidget', () => {
  it('renders loading skeleton when query is loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<ZatcaComplianceWidget />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders title and status when data is loaded', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 100, cleared: 80, reported: 10, pending: 5, rejected: 5, warning: 0 },
      isLoading: false,
    });
    render(<ZatcaComplianceWidget connectionStatus="production" environment="Production" />);
    expect(screen.getByText('ZATCA (Saudi Arabia)')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders period stats with counts', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 100, cleared: 80, reported: 10, pending: 5, rejected: 5, warning: 0 },
      isLoading: false,
    });
    render(<ZatcaComplianceWidget />);
    expect(screen.getByText('This Period')).toBeInTheDocument();
    expect(screen.getByText('80 invoices')).toBeInTheDocument();
    expect(screen.getByText('10 invoices')).toBeInTheDocument();
    const fiveInvoices = screen.getAllByText('5 invoices');
    expect(fiveInvoices).toHaveLength(2); // pending + rejected
  });

  it('renders health percentage', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 100, cleared: 80, reported: 10, pending: 5, rejected: 5, warning: 0 },
      isLoading: false,
    });
    render(<ZatcaComplianceWidget />);
    expect(screen.getByText('Health:')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('renders certificate expiry warning when < 30 days', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 10, cleared: 10, reported: 0, pending: 0, rejected: 0, warning: 0 },
      isLoading: false,
    });
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    render(<ZatcaComplianceWidget certificateExpiresAt={soon} />);
    expect(screen.getByText(/Certificate expires:/)).toBeInTheDocument();
    expect(screen.getByText(/Renew to avoid submission disruption/)).toBeInTheDocument();
  });

  it('shows 100% health when no submissions exist', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 0, cleared: 0, reported: 0, pending: 0, rejected: 0, warning: 0 },
      isLoading: false,
    });
    render(<ZatcaComplianceWidget />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
