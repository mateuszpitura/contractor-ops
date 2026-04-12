import { render, screen, setup } from '@/test/test-utils';
import { VoidEnvelopeDialog } from '../void-envelope-dialog';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    esign: {
      voidEnvelope: { mutationOptions: (opts: any) => opts },
    },
  },
}));

describe('VoidEnvelopeDialog', () => {
  const defaultProps = {
    envelopeId: 'env1',
    open: true,
    onOpenChange: vi.fn(),
    onVoided: vi.fn(),
  };

  it('renders dialog when open', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders reason textarea', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('renders cancel and void buttons', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render when closed', () => {
    render(<VoidEnvelopeDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders reason label', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('renders dialog description', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    // AlertDialogDescription is present
    const descriptions = screen.getAllByText(/void/i);
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it('allows typing a reason in the textarea', async () => {
    const { user } = setup(<VoidEnvelopeDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'No longer needed');
    expect(textarea).toHaveValue('No longer needed');
  });

  it('renders reason placeholder text', () => {
    render(<VoidEnvelopeDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('placeholder');
  });
});
