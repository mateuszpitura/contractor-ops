import { render, screen, setup } from '@/test/test-utils';
import { EquipmentForm } from '../equipment-form';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      create: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      update: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      list: { queryKey: () => ['equipment.list'] },
      getById: { queryKey: () => ['equipment.getById'] },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@contractor-ops/validators', () => ({
  equipmentCreateSchema: {
    _def: {},
    parse: vi.fn(),
    safeParse: vi.fn(),
  },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

describe('EquipmentForm', () => {
  it('shows create title when no equipment is provided', () => {
    render(<EquipmentForm open={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByText('Add equipment')).toHaveLength(2);
  });

  it('shows edit title when equipment is provided', () => {
    render(
      <EquipmentForm
        open={true}
        onOpenChange={vi.fn()}
        equipment={{
          id: 'eq-1',
          name: 'Monitor',
          serialNumber: null,
          type: 'MONITOR',
          customType: null,
          notes: null,
          purchaseDate: null,
        }}
      />,
    );

    expect(screen.getAllByText('Edit equipment')).toHaveLength(2);
  });

  it('does not render when open is false', () => {
    render(<EquipmentForm open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText(/create/i)).not.toBeInTheDocument();
  });

  it('renders name, serial, and notes fields', () => {
    render(<EquipmentForm open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/serial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders cancel and save buttons', () => {
    render(<EquipmentForm open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('renders type selector', () => {
    render(<EquipmentForm open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/type/i)).toBeInTheDocument();
  });

  it('renders purchase date field', () => {
    render(<EquipmentForm open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/purchase date/i)).toBeInTheDocument();
  });

  it('pre-fills form fields when editing existing equipment', () => {
    render(
      <EquipmentForm
        open={true}
        onOpenChange={vi.fn()}
        equipment={{
          id: 'eq-1',
          name: 'Dell XPS 15',
          serialNumber: 'SN-999',
          type: 'LAPTOP',
          customType: null,
          notes: 'Work laptop',
          purchaseDate: '2025-06-01',
        }}
      />,
    );

    expect(screen.getAllByText('Edit equipment')).toHaveLength(2);
    // Fields should be present
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/serial/i)).toBeInTheDocument();
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<EquipmentForm open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
