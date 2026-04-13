import { render, screen } from '@/test/test-utils';
import type { ContractorRow } from '../columns';
import { getColumns } from '../columns';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
}));

vi.mock('../../compliance-health-badge', () => ({
  ComplianceHealthBadge: ({ health }: { health: string }) => (
    <span data-testid="health-badge">{health}</span>
  ),
}));

function makeRow(overrides: Partial<ContractorRow> = {}): ContractorRow {
  return {
    id: 'c-1',
    legalName: 'ACME Sp. z o.o.',
    displayName: 'ACME',
    type: 'COMPANY',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    currency: 'PLN',
    email: 'test@acme.pl',
    taxId: '1234567890',
    customFieldsJson: null,
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    createdAt: null,
    updatedAt: null,
    complianceHealth: 'green',
    ...overrides,
  };
}

/**
 * Helper: render a column cell by extracting the cell function from the column def
 */
function renderCell(columnId: string, row: ContractorRow) {
  const t = (key: string) => key;
  const columns = getColumns(t);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: unknown) => unknown;
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

describe('getColumns', () => {
  const t = (key: string) => key;
  const columns = getColumns(t);

  it('returns 13 columns', () => {
    expect(columns).toHaveLength(13);
  });

  it('has a select column as first', () => {
    expect(columns[0]?.id).toBe('select');
  });

  it('has displayName as non-hideable column', () => {
    const nameCol = columns.find(c => (c as unknown).accessorKey === 'displayName');
    expect(nameCol).toBeDefined();
    expect(nameCol?.enableHiding).toBe(false);
  });

  it('has compliance health as last data column', () => {
    const lastCol = columns[columns.length - 1];
    expect((lastCol as unknown).accessorKey).toBe('complianceHealth');
  });

  it('disables sorting on owner column', () => {
    const ownerCol = columns.find(c => (c as unknown).accessorKey === 'owner');
    expect(ownerCol?.enableSorting).toBe(false);
  });
});

describe('getColumns cell renderers', () => {
  it('name cell shows displayName when present', () => {
    renderCell('displayName', makeRow({ displayName: 'ACME', legalName: 'ACME Sp. z o.o.' }));
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
  });

  it('name cell falls back to legalName when displayName is null', () => {
    renderCell('displayName', makeRow({ displayName: null, legalName: 'ACME Sp. z o.o.' }));
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
    // Should NOT show secondary legalName row since displayName is null
    expect(screen.queryAllByText('ACME Sp. z o.o.')).toHaveLength(1);
  });

  it('type cell renders badge with translated type', () => {
    renderCell('type', makeRow({ type: 'COMPANY' }));
    expect(screen.getByText('type.COMPANY')).toBeInTheDocument();
  });

  it('lifecycleStage cell renders badge for each stage', () => {
    for (const stage of ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED']) {
      const { unmount } = render(
        (() => {
          const t = (key: string) => key;
          const cols = getColumns(t);
          const col = cols.find(c => (c as unknown).accessorKey === 'lifecycleStage');
          const cellFn = col?.cell as (info: unknown) => unknown;
          return cellFn({
            row: {
              original: makeRow({ lifecycleStage: stage }),
              getIsSelected: () => false,
              toggleSelected: vi.fn(),
            },
            getValue: () => stage,
          });
        })(),
      );
      expect(screen.getByText(`lifecycle.${stage}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('owner cell renders mdash when owner is null', () => {
    const container = renderCell('owner', makeRow({ owner: null }));
    expect(container.textContent).toContain('—');
  });

  it('owner cell renders name and avatar when owner exists with image', () => {
    renderCell(
      'owner',
      makeRow({
        owner: { id: 'u1', name: 'Jan Kowalski', image: 'https://example.com/img.jpg' },
      }),
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('owner cell renders owner.id when owner.name is null', () => {
    renderCell(
      'owner',
      makeRow({
        owner: { id: 'u1', name: null, image: null },
      }),
    );
    expect(screen.getByText('u1')).toBeInTheDocument();
  });

  it('billingModel cell renders mdash when customFieldsJson is null', () => {
    const container = renderCell('billingModel', makeRow({ customFieldsJson: null }));
    expect(container.textContent).toContain('—');
  });

  it('billingModel cell renders model when present', () => {
    renderCell(
      'billingModel',
      makeRow({
        customFieldsJson: { billingModel: 'HOURLY' },
      }),
    );
    expect(screen.getByText('billingModel.HOURLY')).toBeInTheDocument();
  });

  it('rate cell renders mdash when rateValueMinor is missing', () => {
    const container = renderCell('rate', makeRow({ customFieldsJson: null }));
    expect(container.textContent).toContain('—');
  });

  it('rate cell renders formatted amount when rateValueMinor is present', () => {
    renderCell(
      'rate',
      makeRow({
        customFieldsJson: { rateValueMinor: 15000 },
        currency: 'PLN',
      }),
    );
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByText(/PLN/)).toBeInTheDocument();
  });

  it('teamProject cell renders mdash when primaryTeam is null', () => {
    const container = renderCell('teamProject', makeRow({ primaryTeam: null }));
    expect(container.textContent).toContain('—');
  });

  it('teamProject cell renders team name when present', () => {
    renderCell('teamProject', makeRow({ primaryTeam: { id: 't1', name: 'Engineering' } }));
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('lastActivity cell renders mdash when updatedAt is null', () => {
    const container = renderCell('lastActivity', makeRow({ updatedAt: null }));
    expect(container.textContent).toContain('—');
  });

  it('lastActivity cell renders relative time when updatedAt is set', () => {
    renderCell('lastActivity', makeRow({ updatedAt: '2026-03-01T00:00:00Z' }));
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('complianceHealth cell renders health badge', () => {
    renderCell('complianceHealth', makeRow({ complianceHealth: 'red' }));
    expect(screen.getByTestId('health-badge')).toHaveTextContent('red');
  });

  it('currency cell renders the currency string', () => {
    renderCell('currency', makeRow({ currency: 'EUR' }));
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });
});
