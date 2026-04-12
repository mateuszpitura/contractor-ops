import { render, screen, setup } from '@/test/test-utils';
import { TopUpDialog } from '../top-up-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    billing: {
      createTopUpCheckout: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopUpDialog', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('does not render content when closed', () => {
    render(<TopUpDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Buy OCR Credits')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(<TopUpDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Buy OCR Credits')).toBeInTheDocument();
    expect(screen.getByText(/Select a credit bundle/)).toBeInTheDocument();
  });

  it('renders Continue to checkout button', () => {
    render(<TopUpDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /continue to checkout/i })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<TopUpDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<TopUpDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
