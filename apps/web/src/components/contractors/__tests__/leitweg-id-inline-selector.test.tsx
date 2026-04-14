import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { LeitwegIdInlineSelector } from '../leitweg-id-inline-selector';
import { PeppolIdentifierFields } from '../peppol-identifier-fields';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let listData: unknown = [];

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: listData, isLoading: false }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      list: { queryOptions: vi.fn(() => ({ queryKey: ['contractor', 'list'] })) },
    },
    leitwegId: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['lid', 'list'] })),
        queryKey: vi.fn(() => ['lid', 'list']),
      },
      listByContractor: {
        queryOptions: vi.fn(() => ({ queryKey: ['lid', 'listByContractor'] })),
      },
      listByContract: {
        queryOptions: vi.fn(() => ({ queryKey: ['lid', 'listByContract'] })),
      },
      create: { mutationOptions: vi.fn(() => ({ mutationKey: ['lid', 'create'] })) },
      update: { mutationOptions: vi.fn(() => ({ mutationKey: ['lid', 'update'] })) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// LeitwegIdInlineSelector tests
// ---------------------------------------------------------------------------

describe('LeitwegIdInlineSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listData = [
      { id: 'lid-1', value: '991-11111TEST-22' },
      { id: 'lid-2', value: '991-22222TEST-33' },
    ];
  });

  it('renders select with the scoped list options', () => {
    render(
      <LeitwegIdInlineSelector
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={() => {}}
      />,
    );
    const select = screen.getByTestId('leitweg-inline-select') as HTMLSelectElement;
    expect(select.options.length).toBe(3); // placeholder + 2 rows
  });

  it('calls onChange when user picks an existing id', async () => {
    const onChange = vi.fn();
    const { user } = setup(
      <LeitwegIdInlineSelector
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={onChange}
      />,
    );
    const select = screen.getByTestId('leitweg-inline-select') as HTMLSelectElement;
    await user.selectOptions(select, 'lid-1');
    expect(onChange).toHaveBeenCalledWith('lid-1');
  });

  it('opens the Create dialog pre-filled when "Add new" is clicked', async () => {
    const { user } = setup(
      <LeitwegIdInlineSelector
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={() => {}}
      />,
    );
    await user.click(screen.getByTestId('leitweg-inline-add-new'));
    expect(screen.getByRole('heading', { name: /create leitweg-id/i })).toBeInTheDocument();
  });

  it('renders the "Leitweg-ID missing" warning alert on DE public-sector buyer without selection', () => {
    render(
      <LeitwegIdInlineSelector
        mode="contractor"
        contractorId="c1"
        value={null}
        onChange={() => {}}
        isPublicSectorBuyer={true}
      />,
    );
    expect(
      screen.getByText(/leitweg-id missing for german public-sector buyer/i),
    ).toBeInTheDocument();
  });

  it('does NOT render the warning when a value is selected', () => {
    render(
      <LeitwegIdInlineSelector
        mode="contractor"
        contractorId="c1"
        value="lid-1"
        onChange={() => {}}
        isPublicSectorBuyer={true}
      />,
    );
    expect(
      screen.queryByText(/leitweg-id missing for german public-sector buyer/i),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PeppolIdentifierFields tests — pair constraint
// ---------------------------------------------------------------------------

describe('PeppolIdentifierFields — pair constraint', () => {
  it('shows no error when both fields are empty', () => {
    render(
      <PeppolIdentifierFields value={{ schemeId: '', value: '' }} onChange={() => {}} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces pair error when only scheme is provided', () => {
    render(
      <PeppolIdentifierFields
        value={{ schemeId: '0060', value: '' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('surfaces pair error when only value is provided', () => {
    render(
      <PeppolIdentifierFields
        value={{ schemeId: '', value: '12345678' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears the pair error when both fields are set', () => {
    render(
      <PeppolIdentifierFields
        value={{ schemeId: '0060', value: '12345678' }}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onValidChange with true when both set and valid', async () => {
    const onValidChange = vi.fn();
    render(
      <PeppolIdentifierFields
        value={{ schemeId: '0060', value: '12345678' }}
        onChange={() => {}}
        onValidChange={onValidChange}
      />,
    );
    // useEffect fires after render
    await Promise.resolve();
    expect(onValidChange).toHaveBeenCalledWith(true);
  });
});
