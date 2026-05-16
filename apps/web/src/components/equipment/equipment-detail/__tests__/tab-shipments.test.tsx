import { render, screen, setup } from '@/test/test-utils';
import { TabShipments } from '../tab-shipments';

// Shared mutable state for useQuery mocks so we can flip results per test.
let listShipmentsResult: {
  data: ReturnType<typeof makeShipment>[] | undefined;
  isLoading: boolean;
  isError: boolean;
} = { data: [], isLoading: false, isError: false };

let getShipmentResult: {
  data: ReturnType<typeof makeShipment> | undefined;
  isLoading: boolean;
  isError: boolean;
} = { data: undefined, isLoading: false, isError: false };

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      fetchQuery: vi.fn().mockResolvedValue({
        data: 'base64data',
        contentType: 'application/pdf',
        filename: 'label.pdf',
      }),
    }),
    useQuery: (opts: { queryKey?: unknown[]; enabled?: boolean }) => {
      const key = JSON.stringify(opts.queryKey ?? []);
      if (key.includes('listShipments')) {
        return {
          ...listShipmentsResult,
          refetch: vi.fn(),
        };
      }
      if (key.includes('getShipment')) {
        return getShipmentResult;
      }
      return { data: undefined, isLoading: false, isError: false };
    },
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      listShipments: {
        queryOptions: (input: unknown) => ({ queryKey: ['equipment.listShipments', input] }),
      },
      getShipment: {
        queryOptions: (input: unknown) => ({ queryKey: ['equipment.getShipment', input] }),
      },
      getShipmentLabel: {
        queryOptions: (input: unknown) => ({ queryKey: ['equipment.getShipmentLabel', input] }),
      },
      deleteShipment: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      pathFilter: () => ({ queryKey: ['equipment'] }),
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/equipment/shipment-timeline', () => ({
  ShipmentTimeline: () => <div data-testid="shipment-timeline" />,
}));

vi.mock('@/components/equipment/shipment-status-badge', () => ({
  ShipmentStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('@/components/equipment/return-approval-banner', () => ({
  ReturnApprovalBanner: () => <div data-testid="return-banner" />,
}));

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 's-1',
    direction: 'OUTBOUND',
    carrier: 'InPost',
    carrierCustom: null,
    trackingNumber: 'TR-12345',
    currentStatus: 'CREATED',
    expectedDeliveryAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    events: [],
    ...overrides,
  };
}

describe('TabShipments', () => {
  beforeEach(() => {
    listShipmentsResult = { data: [], isLoading: false, isError: false };
    getShipmentResult = { data: undefined, isLoading: false, isError: false };
  });

  it('renders empty state when no shipments', () => {
    render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(screen.getByText(/no shipments/i)).toBeInTheDocument();
  });

  it('renders shipment row with tracking number and carrier', () => {
    listShipmentsResult = { data: [makeShipment()], isLoading: false, isError: false };
    render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('InPost')).toBeInTheDocument();
  });

  it('invokes onCreateShipment from empty state CTA', async () => {
    const onCreateShipment = vi.fn();
    const { user } = setup(<TabShipments equipmentId="eq-1" onCreateShipment={onCreateShipment} />);

    const btn = screen.getByRole('button', { name: /create shipment/i });
    await user.click(btn);
    expect(onCreateShipment).toHaveBeenCalledTimes(1);
  });

  it('renders return approval banner when pendingReturn is provided', () => {
    render(
      <TabShipments
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
        pendingReturn={{
          id: 'r-1',
          contractorName: 'Jan',
          itemCount: 2,
          targetPointName: 'WAW123',
          createdAt: '2026-03-01',
        }}
      />,
    );

    expect(screen.getByTestId('return-banner')).toBeInTheDocument();
  });

  it('shows delete button only for CREATED shipments', () => {
    listShipmentsResult = {
      data: [makeShipment({ currentStatus: 'CREATED' })],
      isLoading: false,
      isError: false,
    };
    const { container } = render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    const trash = container.querySelector('.text-destructive');
    expect(trash).toBeTruthy();
  });

  it('hides delete button for non-CREATED shipments', () => {
    listShipmentsResult = {
      data: [makeShipment({ currentStatus: 'IN_TRANSIT' })],
      isLoading: false,
      isError: false,
    };
    const { container } = render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(container.querySelector('button.text-destructive')).toBeNull();
  });

  it('renders multiple shipments as table rows', () => {
    listShipmentsResult = {
      data: [makeShipment({ id: 's-1' }), makeShipment({ id: 's-2', trackingNumber: 'TR-99999' })],
      isLoading: false,
      isError: false,
    };
    render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('TR-99999')).toBeInTheDocument();
  });

  it('shows label action only for InPost shipments', () => {
    listShipmentsResult = {
      data: [
        makeShipment({ id: 's-inpost', carrier: 'InPost' }),
        makeShipment({ id: 's-other', carrier: 'DPD' }),
      ],
      isLoading: false,
      isError: false,
    };
    render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    const labelButtons = screen.queryAllByLabelText(/label/i);
    expect(labelButtons.length).toBe(1);
  });

  it('opens detail sheet when View action is clicked', async () => {
    listShipmentsResult = {
      data: [makeShipment()],
      isLoading: false,
      isError: false,
    };
    getShipmentResult = { data: makeShipment(), isLoading: false, isError: false };

    const { user } = setup(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    const viewButtons = screen.getAllByLabelText(/view/i);
    expect(viewButtons.length).toBeGreaterThan(0);
    const viewBtn = viewButtons[0];
    if (!viewBtn) throw new Error('view button missing');
    await user.click(viewBtn);

    // Timeline is rendered inside the sheet content
    expect(screen.getByTestId('shipment-timeline')).toBeInTheDocument();
  });

  it('shows loading skeleton while shipments are loading', () => {
    listShipmentsResult = { data: undefined, isLoading: true, isError: false };
    const { container } = render(<TabShipments equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length,
    ).toBeGreaterThan(0);
  });
});
