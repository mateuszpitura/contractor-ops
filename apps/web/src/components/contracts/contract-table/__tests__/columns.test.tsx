import { render, screen } from '@/test/test-utils';
import type { ContractRow } from '../columns';
import { getColumns } from '../columns';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
  differenceInDays: () => 30,
  isPast: () => false,
}));

function makeRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: 'ct-1',
    title: 'B2B Agreement',
    type: 'B2B_MASTER_SERVICE',
    status: 'ACTIVE',
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    currency: 'PLN',
    billingModel: 'HOURLY',
    rateType: 'PER_HOUR',
    rateValueMinor: 15000,
    complianceRiskLevel: null,
    contractor: { id: 'c-1', legalName: 'ACME Sp. z o.o.', displayName: 'ACME' },
    internalOwner: { id: 'u1', name: 'Jan Kowalski' },
    ...overrides,
  };
}

function renderCell(columnId: string, row: ContractRow) {
  const t = (key: string) => key;
  const columns = getColumns(t);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: any) => any;
  const result = cellFn({
    row: {
      original: row,
      getIsSelected: () => false,
      toggleSelected: vi.fn(),
    },
    getValue: () => (row as unknown)[columnId],
  });
  const { container } = render(result);
  return container;
}

describe('getColumns (contracts)', () => {
  const t = (key: string) => key;
  const columns = getColumns(t);

  it('returns 12 columns', () => {
    expect(columns).toHaveLength(12);
  });

  it('has select column as first', () => {
    expect(columns[0]?.id).toBe('select');
  });

  it('has title as non-hideable column', () => {
    const titleCol = columns.find(c => (c as unknown).accessorKey === 'title');
    expect(titleCol).toBeDefined();
    expect(titleCol?.enableHiding).toBe(false);
  });

  it('has contractor column', () => {
    const col = columns.find(c => c.id === 'contractor');
    expect(col).toBeDefined();
  });

  it('has compliance risk column', () => {
    const col = columns.find(c => (c as unknown).accessorKey === 'complianceRiskLevel');
    expect(col).toBeDefined();
  });

  it('disables sorting on rate column', () => {
    const rateCol = columns.find(c => (c as unknown).accessorKey === 'rateValueMinor');
    expect(rateCol?.enableSorting).toBe(false);
  });
});

describe('getColumns cell renderers (contracts)', () => {
  it('title cell renders title text', () => {
    renderCell('title', makeRow({ title: 'Service Contract' }));
    expect(screen.getByText('Service Contract')).toBeInTheDocument();
  });

  it('contractor cell shows displayName when present', () => {
    renderCell(
      'contractor',
      makeRow({
        contractor: { id: 'c-1', legalName: 'ACME Sp. z o.o.', displayName: 'ACME' },
      }),
    );
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('contractor cell falls back to legalName when displayName is null', () => {
    renderCell(
      'contractor',
      makeRow({
        contractor: { id: 'c-1', legalName: 'ACME Sp. z o.o.', displayName: null },
      }),
    );
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
  });

  it('status cell renders badge with translated status', () => {
    for (const status of ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']) {
      const { unmount } = render(
        (() => {
          const t = (key: string) => key;
          const cols = getColumns(t);
          const col = cols.find(c => (c as unknown).accessorKey === 'status');
          return (col?.cell as unknown)({
            row: {
              original: makeRow({ status }),
              getIsSelected: () => false,
              toggleSelected: vi.fn(),
            },
            getValue: () => status,
          });
        })(),
      );
      expect(screen.getByText(`status.${status}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('startDate cell renders mdash when null', () => {
    const container = renderCell('startDate', makeRow({ startDate: null }));
    expect(container.textContent).toContain('—');
  });

  it('startDate cell renders formatted date when present', () => {
    renderCell('startDate', makeRow({ startDate: '2024-06-15' }));
    // pl-PL date format
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('endDate cell renders mdash when null', () => {
    const container = renderCell('endDate', makeRow({ endDate: null }));
    expect(container.textContent).toContain('—');
  });

  it('endDate cell renders formatted date with tooltip when present', () => {
    renderCell('endDate', makeRow({ endDate: '2025-12-31' }));
    expect(screen.getByText(/31/)).toBeInTheDocument();
  });

  it('rate cell renders mdash when rateValueMinor is null', () => {
    const container = renderCell('rateValueMinor', makeRow({ rateValueMinor: null }));
    expect(container.textContent).toContain('—');
  });

  it('rate cell renders formatted amount when present', () => {
    renderCell('rateValueMinor', makeRow({ rateValueMinor: 25000 }));
    expect(screen.getByText(/250,00/)).toBeInTheDocument();
  });

  it('owner cell renders mdash when internalOwner is null', () => {
    const container = renderCell('internalOwner', makeRow({ internalOwner: null }));
    expect(container.textContent).toContain('—');
  });

  it('owner cell renders name when present', () => {
    renderCell('internalOwner', makeRow({ internalOwner: { id: 'u1', name: 'Jan' } }));
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  it('owner cell falls back to id when name is null', () => {
    renderCell('internalOwner', makeRow({ internalOwner: { id: 'u1', name: null } }));
    expect(screen.getByText('u1')).toBeInTheDocument();
  });

  it('complianceRisk cell renders mdash when null', () => {
    const container = renderCell('complianceRiskLevel', makeRow({ complianceRiskLevel: null }));
    expect(container.textContent).toContain('—');
  });

  it('complianceRisk cell renders risk badge when present', () => {
    for (const risk of ['LOW', 'MEDIUM', 'HIGH']) {
      const { unmount } = render(
        (() => {
          const t = (key: string) => key;
          const cols = getColumns(t);
          const col = cols.find(c => (c as unknown).accessorKey === 'complianceRiskLevel');
          return (col?.cell as unknown)({
            row: {
              original: makeRow({ complianceRiskLevel: risk }),
              getIsSelected: () => false,
              toggleSelected: vi.fn(),
            },
            getValue: () => risk,
          });
        })(),
      );
      expect(screen.getByText(`risk.${risk}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('currency cell renders the currency string', () => {
    renderCell('currency', makeRow({ currency: 'EUR' }));
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('billingModel cell renders translated billing model', () => {
    renderCell('billingModel', makeRow({ billingModel: 'FIXED' }));
    expect(screen.getByText('billingModel.FIXED')).toBeInTheDocument();
  });
});
