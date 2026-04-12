import { render, screen, setup } from '@/test/test-utils';
import { EquipmentDetailHeader } from '../equipment-detail-header';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      retire: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      unassign: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      getById: { queryKey: () => ['equipment.getById'] },
      list: { queryKey: () => ['equipment.list'] },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeEquipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eq-1',
    name: 'MacBook Pro 16',
    serialNumber: 'SN-123456',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    currentAssignment: null,
    ...overrides,
  };
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    equipment: makeEquipment(overrides),
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onCreateShipment: vi.fn(),
  };
}

describe('EquipmentDetailHeader', () => {
  it('renders equipment name and serial number', () => {
    render(<EquipmentDetailHeader {...makeProps()} />);

    expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
    expect(screen.getByText('SN-123456')).toBeInTheDocument();
  });

  it('shows assign button when status is AVAILABLE', () => {
    render(<EquipmentDetailHeader {...makeProps({ status: 'AVAILABLE' })} />);

    expect(screen.getByRole('button', { name: /assign/i })).toBeInTheDocument();
  });

  it('shows unassign button when status is ASSIGNED', () => {
    render(
      <EquipmentDetailHeader
        {...makeProps({
          status: 'ASSIGNED',
          currentAssignment: {
            id: 'a-1',
            contractorId: 'c-1',
            contractor: { id: 'c-1', legalName: 'Acme', displayName: null },
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /unassign/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign to/i })).not.toBeInTheDocument();
  });

  it('hides assign and shipment buttons when RETIRED', () => {
    render(<EquipmentDetailHeader {...makeProps({ status: 'RETIRED' })} />);

    expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /shipment/i })).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const { user } = setup(<EquipmentDetailHeader {...makeProps()} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateShipment when shipment button is clicked', async () => {
    const onCreateShipment = vi.fn();
    const { user } = setup(
      <EquipmentDetailHeader {...makeProps()} onCreateShipment={onCreateShipment} />,
    );

    await user.click(screen.getByRole('button', { name: /shipment/i }));
    expect(onCreateShipment).toHaveBeenCalledTimes(1);
  });

  it('calls onAssign when assign button is clicked', async () => {
    const onAssign = vi.fn();
    const { user } = setup(
      <EquipmentDetailHeader {...makeProps({ status: 'AVAILABLE' })} onAssign={onAssign} />,
    );

    await user.click(screen.getByRole('button', { name: /assign/i }));
    expect(onAssign).toHaveBeenCalledTimes(1);
  });

  it('renders equipment type badge', () => {
    render(<EquipmentDetailHeader {...makeProps()} />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('does not show serial number when it is null', () => {
    render(<EquipmentDetailHeader {...makeProps({ serialNumber: null })} />);
    expect(screen.queryByText('SN-123456')).not.toBeInTheDocument();
  });

  it('shows create shipment button for AVAILABLE equipment', () => {
    render(<EquipmentDetailHeader {...makeProps({ status: 'AVAILABLE' })} />);
    expect(screen.getByRole('button', { name: /shipment/i })).toBeInTheDocument();
  });

  it('shows create shipment button for ASSIGNED equipment', () => {
    render(
      <EquipmentDetailHeader
        {...makeProps({
          status: 'ASSIGNED',
          currentAssignment: {
            id: 'a-1',
            contractorId: 'c-1',
            contractor: { id: 'c-1', legalName: 'Acme', displayName: null },
          },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /shipment/i })).toBeInTheDocument();
  });

  it('shows unassign dialog when unassign button is clicked', async () => {
    const { user } = setup(
      <EquipmentDetailHeader
        {...makeProps({
          status: 'ASSIGNED',
          currentAssignment: {
            id: 'a-1',
            contractorId: 'c-1',
            contractor: { id: 'c-1', legalName: 'Acme', displayName: 'Acme Corp' },
          },
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /unassign/i }));
    // Dialog should appear - there should now be multiple "Unassign equipment" texts (button + dialog)
    expect(screen.getAllByText(/unassign/i).length).toBeGreaterThan(1);
  });

  it('always shows edit button regardless of status', () => {
    render(<EquipmentDetailHeader {...makeProps({ status: 'RETIRED' })} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});
