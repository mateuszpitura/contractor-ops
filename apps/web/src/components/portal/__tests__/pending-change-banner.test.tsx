import { render, screen, setup } from '@/test/test-utils';
import { PendingChangeBanner } from '../pending-change-banner';

describe('PendingChangeBanner', () => {
  const defaultProps = {
    pendingChangeRequest: {
      requestedChanges: {
        bankAccountNumber: 'PL61 1090 1014 0000 0712 1981 2874',
        bankName: 'Santander',
      },
      createdAt: new Date('2026-03-15'),
    },
  };

  it('renders pending approval heading', () => {
    render(<PendingChangeBanner {...defaultProps} />);

    expect(screen.getByText('Changes Pending Approval')).toBeInTheDocument();
  });

  it('shows submission date', () => {
    render(<PendingChangeBanner {...defaultProps} />);

    expect(screen.getByText(/March 15, 2026/)).toBeInTheDocument();
  });

  it('renders view submitted changes toggle', () => {
    render(<PendingChangeBanner {...defaultProps} />);

    expect(screen.getByText('View submitted changes')).toBeInTheDocument();
  });

  it('shows change details when expanded', async () => {
    const { user } = setup(<PendingChangeBanner {...defaultProps} />);

    await user.click(screen.getByText('View submitted changes'));

    expect(screen.getByText('Bank Account Number')).toBeInTheDocument();
    expect(screen.getByText('Santander')).toBeInTheDocument();
  });
});
