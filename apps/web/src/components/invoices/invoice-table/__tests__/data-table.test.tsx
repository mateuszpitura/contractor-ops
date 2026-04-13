import { useQuery } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup, within } from '@/test/test-utils';
import type { InvoiceRow } from '../columns';
import { InvoiceDataTable } from '../data-table';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      list: {
        queryOptions: vi.fn((input: unknown) => ({
          queryKey: ['invoice', 'list', input],
        })),
      },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

function baseRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: 'inv-dt-1',
    invoiceNumber: 'FV/DATA/01',
    issueDate: '2026-01-15T00:00:00.000Z',
    dueDate: '2030-06-01T00:00:00.000Z',
    subtotalMinor: 10000,
    totalMinor: 12300,
    currency: 'PLN',
    status: 'RECEIVED',
    matchStatus: 'MATCHED',
    source: 'MANUAL_UPLOAD',
    contractor: { id: 'c-1', legalName: 'Acme Sp. z o.o.' },
    ...overrides,
  };
}

function renderTable(ui: ReactNode, searchParams = '') {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      {ui}
    </NuqsTestingAdapter>,
  );
}

describe('InvoiceDataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton rows while the list query is pending without data', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
    } as ReturnType<typeof useQuery>);

    const { container } = renderTable(<InvoiceDataTable onRowClick={vi.fn()} onUpload={vi.fn()} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders invoice rows and calls onRowClick with the row payload', async () => {
    const row = baseRow();
    mockedUseQuery.mockReturnValue({
      data: { items: [row], totalCount: 1 },
      isPending: false,
      isFetching: false,
    } as ReturnType<typeof useQuery>);

    const onRowClick = vi.fn();
    const { user } = setup(
      <NuqsTestingAdapter searchParams="" hasMemory>
        <InvoiceDataTable onRowClick={onRowClick} onUpload={vi.fn()} />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByText('FV/DATA/01')).toBeInTheDocument();

    const dataRow = screen.getByText('FV/DATA/01').closest('tr');
    expect(dataRow).toBeTruthy();
    await user.click(dataRow);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv-dt-1' }));
  });

  it('shows the filtered empty state when there are no rows but search is active', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isPending: false,
      isFetching: false,
    } as ReturnType<typeof useQuery>);

    renderTable(
      <InvoiceDataTable onRowClick={vi.fn()} onUpload={vi.fn()} />,
      '?search=nothingmatches',
    );

    expect(screen.getByRole('heading', { name: /no invoices found/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('shows the default empty state and calls onUpload from the CTA', async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isPending: false,
      isFetching: false,
    } as ReturnType<typeof useQuery>);

    const onUpload = vi.fn();
    const { user } = setup(
      <NuqsTestingAdapter searchParams="" hasMemory>
        <InvoiceDataTable onRowClick={vi.fn()} onUpload={onUpload} />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByRole('heading', { name: /no invoices yet/i })).toBeInTheDocument();

    const emptyCell = screen.getByRole('heading', { name: /no invoices yet/i }).closest('td');
    await user.click(within(emptyCell).getByRole('button', { name: /upload invoices/i }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('applies overdue styling when due date is in the past and status is not terminal', () => {
    const pastDue = '2020-01-01T00:00:00.000Z';
    mockedUseQuery.mockReturnValue({
      data: {
        items: [baseRow({ dueDate: pastDue, status: 'RECEIVED' })],
        totalCount: 1,
      },
      isPending: false,
      isFetching: false,
    } as ReturnType<typeof useQuery>);

    renderTable(<InvoiceDataTable onRowClick={vi.fn()} onUpload={vi.fn()} />);

    const row = screen.getByText('FV/DATA/01').closest('tr');
    expect(row?.className).toMatch(/destructive/);
  });
});
