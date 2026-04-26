import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

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
    peppol: {
      connect: { mutationOptions: (opts: Record<string, unknown>) => opts },
      getStatus: { queryKey: () => ['peppol', 'getStatus'] },
    },
  },
}));

import { PeppolWizard } from '../peppol-wizard';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
};

describe('PeppolWizard', () => {
  it('renders dialog title and description when open', () => {
    render(<PeppolWizard {...defaultProps} />);
    expect(screen.getByText('Connect to Peppol Network')).toBeInTheDocument();
    expect(
      screen.getByText(/Register your organization on the Peppol network/),
    ).toBeInTheDocument();
  });

  it('renders step 1 content by default', () => {
    render(<PeppolWizard {...defaultProps} />);
    expect(screen.getByText('Step 1: Tax Registration Number')).toBeInTheDocument();
    expect(screen.getByText('15-digit UAE TRN')).toBeInTheDocument();
  });

  it('has Next button disabled on step 1 when TRN is empty', () => {
    render(<PeppolWizard {...defaultProps} />);
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next button when valid 15-digit TRN is entered', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(nextBtn).toBeEnabled();
  });

  it('shows Peppol Participant ID preview after entering 15-digit TRN', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    expect(screen.getByText('0192:123456789012345')).toBeInTheDocument();
  });

  it('navigates to step 2 on Next click', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2: Select ASP Provider')).toBeInTheDocument();
    expect(screen.getByText('Storecove')).toBeInTheDocument();
  });

  it('navigates to step 3 and shows API key input', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Step 3: API Credentials')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument();
  });

  it('shows Back button on step 2', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('navigates back from step 2 to step 1', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1: Tax Registration Number')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<PeppolWizard open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Connect to Peppol Network')).not.toBeInTheDocument();
  });

  it('shows environment radio options on step 3', async () => {
    const { user } = setup(<PeppolWizard {...defaultProps} />);
    const input = screen.getByPlaceholderText('123456789012345');
    await user.type(input, '123456789012345');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Sandbox (testing)')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });
});
