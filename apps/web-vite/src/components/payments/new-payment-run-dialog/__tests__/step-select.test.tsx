/**
 * Web-vite split: StepSelectView is the presentational shell that wraps a
 * `children` slot picked by wired `StepSelect`. The empty / data-table
 * variants are siblings (`StepSelectEmptyState` + `StepSelectDataTable`).
 * Tests exercise the shell with stub children and assert the sibling
 * components render their respective copy/elements.
 */

vi.mock('../../invoice-selection-table/data-table', () => ({
  InvoiceSelectionDataTable: () => <div data-testid="invoice-data-table" />,
}));

import { render, screen, setup } from '@/test/test-utils';

import { StepSelectDataTable, StepSelectEmptyState, StepSelectView } from '../step-select';

function makeFilters(overrides: Partial<Parameters<typeof StepSelectView>[0]['filters']> = {}) {
  return {
    currency: 'all',
    setCurrency: vi.fn(),
    dueDateFrom: undefined,
    setDueDateFrom: vi.fn(),
    dueDateTo: undefined,
    setDueDateTo: vi.fn(),
    contractorSearch: '',
    setContractorSearch: vi.fn(),
    ...overrides,
  };
}

function makeFooter(overrides: Partial<Parameters<typeof StepSelectView>[0]['footer']> = {}) {
  return {
    selectedInvoiceIds: [],
    selectedInvoiceCountsByCurrency: [],
    uniqueCurrencies: [],
    groupByCurrency: false,
    onGroupByCurrencyChange: vi.fn(),
    onCancel: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

const formatDateRange = (d: Date, t?: Date) => `${String(d)}-${t ? String(t) : ''}`;

describe('StepSelectView shell', () => {
  it('renders the contractor search input', () => {
    render(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter()}
        formatDateRange={formatDateRange}
        selectAllMatching={null}>
        <div>middle</div>
      </StepSelectView>,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('invokes onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const { user } = setup(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter({ onCancel })}
        formatDateRange={formatDateRange}
        selectAllMatching={null}>
        <div />
      </StepSelectView>,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Next when no invoices are selected', () => {
    render(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter()}
        formatDateRange={formatDateRange}
        selectAllMatching={null}>
        <div />
      </StepSelectView>,
    );
    expect(screen.getByRole('button', { name: /review/i })).toBeDisabled();
  });

  it('enables Next once invoices are selected', () => {
    render(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter({ selectedInvoiceIds: ['inv-1'] })}
        formatDateRange={formatDateRange}
        selectAllMatching={null}>
        <div />
      </StepSelectView>,
    );
    expect(screen.getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('invokes onNext when Next is clicked', async () => {
    const onNext = vi.fn();
    const { user } = setup(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter({ selectedInvoiceIds: ['inv-1'], onNext })}
        formatDateRange={formatDateRange}
        selectAllMatching={null}>
        <div />
      </StepSelectView>,
    );
    await user.click(screen.getByRole('button', { name: /review/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders the select-all-matching action when provided', async () => {
    const onClick = vi.fn();
    const { user } = setup(
      <StepSelectView
        filters={makeFilters()}
        footer={makeFooter()}
        formatDateRange={formatDateRange}
        selectAllMatching={{ count: 4, onClick }}>
        <div />
      </StepSelectView>,
    );
    const link = screen.getByRole('button', { name: /select all matching/i });
    expect(link).toBeInTheDocument();
    await user.click(link);
    expect(onClick).toHaveBeenCalled();
  });
});

describe('StepSelectEmptyState', () => {
  it('renders the no-invoices heading + body', () => {
    render(<StepSelectEmptyState />);
    expect(screen.getByText('No approved invoices')).toBeInTheDocument();
  });
});

describe('StepSelectDataTable', () => {
  it('renders the mocked invoice data table', () => {
    render(
      <StepSelectDataTable
        data={[]}
        columns={[]}
        isLoading={false}
        rowSelection={{}}
        onRowSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('invoice-data-table')).toBeInTheDocument();
  });
});
