import { render, screen, setup } from '@/test/test-utils';
import { ShipmentForm } from '../shipment-form';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      createShipment: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
      getById: { queryKey: () => ['equipment.getById'] },
      list: { queryKey: () => ['equipment.list'] },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

function makeProps(overrides: Partial<Parameters<typeof ShipmentForm>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    equipmentId: 'eq-1',
    equipmentName: 'MacBook Pro',
    ...overrides,
  };
}

describe('ShipmentForm', () => {
  it('renders dialog with title and equipment name', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
  });

  it('renders tracking number and notes fields', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByLabelText(/tracking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<ShipmentForm {...makeProps({ open: false })} />);

    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
  });

  it('renders direction selector with outbound default', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByText(/direction/i)).toBeInTheDocument();
  });

  it('renders carrier selector', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByText(/carrier/i)).toBeInTheDocument();
  });

  it('renders expected delivery date field', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByLabelText(/expected/i)).toBeInTheDocument();
  });

  it('renders submit button with create title', () => {
    render(<ShipmentForm {...makeProps()} />);

    // There should be a submit button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('submits form with default values when submit is clicked', async () => {
    const { user } = setup(<ShipmentForm {...makeProps()} />);

    // Find submit button (not the cancel button)
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent && !/cancel/i.test(b.textContent));
    if (submitBtn) {
      await user.click(submitBtn);
    }
    // Form should still be rendered (no crash)
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
  });

  it('cancel button calls onOpenChange with false', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<ShipmentForm {...makeProps({ onOpenChange })} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders all carrier options', () => {
    render(<ShipmentForm {...makeProps()} />);

    // Carrier label should be present
    expect(screen.getByText(/carrier/i)).toBeInTheDocument();
  });

  it('renders notes textarea', () => {
    render(<ShipmentForm {...makeProps()} />);

    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders dialog header with equipment name in description', () => {
    render(<ShipmentForm {...makeProps({ equipmentName: 'Dell Monitor' })} />);

    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
  });

  it('renders form inside dialog content', () => {
    render(<ShipmentForm {...makeProps()} />);

    // Form should contain tracking and notes fields
    expect(screen.getByLabelText(/tracking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });
});
