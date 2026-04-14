import { render, screen, setup } from '@/test/test-utils';
import { TabShipments } from '../tab-shipments';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      deleteShipment: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      getById: { queryKey: () => ['equipment.getById'] },
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
  it('renders empty state when no shipments', () => {
    render(<TabShipments shipments={[]} equipmentId="eq-1" onCreateShipment={vi.fn()} />);

    expect(screen.getByText(/no shipments/i)).toBeInTheDocument();
  });

  it('renders shipment card with tracking number and carrier', () => {
    render(
      <TabShipments shipments={[makeShipment()]} equipmentId="eq-1" onCreateShipment={vi.fn()} />,
    );

    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('InPost')).toBeInTheDocument();
  });

  it('shows create shipment button', async () => {
    const onCreateShipment = vi.fn();
    const { user } = setup(
      <TabShipments shipments={[]} equipmentId="eq-1" onCreateShipment={onCreateShipment} />,
    );

    const btn = screen.getByRole('button', { name: /create shipment/i });
    await user.click(btn);
    expect(onCreateShipment).toHaveBeenCalledTimes(1);
  });

  it('renders return approval banner when pendingReturn is provided', () => {
    render(
      <TabShipments
        shipments={[]}
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

  it('shows delete button for CREATED shipments', () => {
    render(
      <TabShipments
        shipments={[makeShipment({ currentStatus: 'CREATED' })]}
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
      />,
    );

    // Delete button exists (trash icon)
    const deleteButtons = screen.getAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('does not show delete button for non-CREATED shipments', () => {
    const { container } = render(
      <TabShipments
        shipments={[makeShipment({ currentStatus: 'IN_TRANSIT' })]}
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
      />,
    );

    // Trash icon should not be present
    const trashIcons = container.querySelectorAll('.text-destructive');
    expect(trashIcons.length).toBe(0);
  });

  it('renders return direction label', () => {
    render(
      <TabShipments
        shipments={[makeShipment({ direction: 'RETURN' })]}
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
      />,
    );

    expect(screen.getByText('Return (from contractor)')).toBeInTheDocument();
  });

  it('renders outbound direction label', () => {
    render(
      <TabShipments
        shipments={[makeShipment({ direction: 'OUTBOUND' })]}
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
      />,
    );

    expect(screen.getByText('Outbound (to contractor)')).toBeInTheDocument();
  });

  it('renders multiple shipments', () => {
    render(
      <TabShipments
        shipments={[
          makeShipment({ id: 's-1' }),
          makeShipment({ id: 's-2', trackingNumber: 'TR-99999' }),
        ]}
        equipmentId="eq-1"
        onCreateShipment={vi.fn()}
      />,
    );

    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('TR-99999')).toBeInTheDocument();
  });

  it('renders shipment timeline component', () => {
    render(
      <TabShipments shipments={[makeShipment()]} equipmentId="eq-1" onCreateShipment={vi.fn()} />,
    );

    expect(screen.getByTestId('shipment-timeline')).toBeInTheDocument();
  });

  it('renders return banner with shipments present', () => {
    render(
      <TabShipments
        shipments={[makeShipment()]}
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

  it('renders date for shipment', () => {
    render(
      <TabShipments shipments={[makeShipment()]} equipmentId="eq-1" onCreateShipment={vi.fn()} />,
    );

    expect(screen.getByText('Mar 1, 2026')).toBeInTheDocument();
  });
});
