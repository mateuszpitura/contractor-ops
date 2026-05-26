/**
 * web-vite port of apps/web/.../tab-payments.test.tsx.
 *
 * Container/component split — `TabPaymentsView` takes the
 * `useContractorTabPayments` hook return as props. Tests inject a shaped
 * stub instead of mocking tRPC + react-query.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) =>
      typeof v === 'string' && v.length >= 10
        ? `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}`
        : '',
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { ContractorTabPaymentRow } from '../../hooks/use-contractor-tab-payments.js';
import { TabPaymentsView } from '../tab-payments.js';

type ViewProps = Parameters<typeof TabPaymentsView>[0];

function formatAmount(minor: number, currency: string): string {
  return `${new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)} ${currency}`;
}

interface Overrides {
  items?: ContractorTabPaymentRow[];
  allItems?: ContractorTabPaymentRow[];
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  totalPaidMinor?: number;
  totalPaidCurrency?: string;
  setPage?: ViewProps['setPage'];
}

function buildProps(override: Overrides = {}): ViewProps {
  const items = override.items ?? [];
  const allItems = override.allItems ?? items;
  return {
    contractorId: 'c1',
    page: override.page ?? 1,
    setPage: override.setPage ?? vi.fn(),
    items,
    allItems,
    totalPages: override.totalPages ?? 1,
    totalPaidMinor:
      override.totalPaidMinor ??
      allItems.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amountMinor, 0),
    totalPaidCurrency: override.totalPaidCurrency ?? allItems[0]?.currency ?? 'PLN',
    formatAmount,
    isLoading: override.isLoading ?? false,
  };
}

const baseRow = (over: Partial<ContractorTabPaymentRow> = {}): ContractorTabPaymentRow => ({
  id: 'pi-1',
  paymentRunId: 'pr-1',
  runNumber: 'PR-001',
  invoiceId: 'inv-1',
  invoiceNumber: 'FV/2025/001',
  amountMinor: 150000,
  currency: 'PLN',
  status: 'PAID',
  paymentReference: 'REF-001',
  markedPaidAt: '2025-01-20T10:00:00Z',
  createdAt: '2025-01-15T10:00:00Z',
  ...over,
});

describe('TabPaymentsView', () => {
  it('renders empty state heading when no payments exist', () => {
    render(<TabPaymentsView {...buildProps()} />);
    expect(screen.getByText('No payments for this contractor')).toBeInTheDocument();
  });

  it('renders empty state body referencing payment runs', () => {
    render(<TabPaymentsView {...buildProps()} />);
    expect(screen.getByText(/payment runs/i)).toBeInTheDocument();
  });

  it('renders an svg illustration in the empty state', () => {
    const { container } = render(<TabPaymentsView {...buildProps()} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders payment table rows with run number + invoice number', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
  });

  it('renders formatted amount in table cell', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    const matches = screen.getAllByText(/1.*500,00 PLN/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the PAID status badge', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ status: 'PAID' })],
          allItems: [baseRow({ status: 'PAID' })],
        })}
      />,
    );
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders the PENDING status badge', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ status: 'PENDING', paymentReference: null })],
          allItems: [baseRow({ status: 'PENDING', paymentReference: null })],
        })}
      />,
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders the FAILED status badge', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ status: 'FAILED', paymentReference: null })],
          allItems: [baseRow({ status: 'FAILED', paymentReference: null })],
        })}
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders the total-paid header label', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    expect(screen.getByText('Total paid:')).toBeInTheDocument();
  });

  it('renders the section heading "Payments" when items exist', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('renders payment reference when present', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ paymentReference: 'SWIFT-REF-12345' })],
          allItems: [baseRow({ paymentReference: 'SWIFT-REF-12345' })],
        })}
      />,
    );
    expect(screen.getByText('SWIFT-REF-12345')).toBeInTheDocument();
  });

  it('renders em dash for null payment reference', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ paymentReference: null })],
          allItems: [baseRow({ paymentReference: null })],
        })}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders run number as link to /payments', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    const link = screen.getByText('PR-001');
    expect(link.closest('a')?.getAttribute('href')).toMatch(/\/payments$/);
  });

  it('renders invoice number as link to /invoices/:id', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ invoiceId: 'inv-99', invoiceNumber: 'FV/099' })],
          allItems: [baseRow({ invoiceId: 'inv-99', invoiceNumber: 'FV/099' })],
        })}
      />,
    );
    const link = screen.getByText('FV/099');
    expect(link.closest('a')?.getAttribute('href')).toMatch(/\/invoices\/inv-99$/);
  });

  it('renders date column with formatted date', () => {
    render(
      <TabPaymentsView
        {...buildProps({
          items: [baseRow({ createdAt: '2025-03-15T10:00:00Z' })],
          allItems: [baseRow({ createdAt: '2025-03-15T10:00:00Z' })],
        })}
      />,
    );
    expect(screen.getByText('15.03.2025')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    const headers = document.querySelectorAll('th');
    expect(headers.length).toBeGreaterThanOrEqual(4);
  });

  it('does not render pagination when totalPages == 1', () => {
    render(<TabPaymentsView {...buildProps({ items: [baseRow()], allItems: [baseRow()] })} />);
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('renders pagination when totalPages > 1', () => {
    const rows = Array.from({ length: 25 }).map((_, i) =>
      baseRow({ id: `pi-${i}`, invoiceId: `inv-${i}` }),
    );
    render(
      <TabPaymentsView
        {...buildProps({ items: rows.slice(0, 10), allItems: rows, totalPages: 3 })}
      />,
    );
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});
