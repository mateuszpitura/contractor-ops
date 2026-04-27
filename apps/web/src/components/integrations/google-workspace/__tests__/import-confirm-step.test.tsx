import { render, screen } from '@/test/test-utils';
import { ImportConfirmStep } from '../import-confirm-step';

describe('ImportConfirmStep', () => {
  const defaultProps = {
    userCount: 5,
    roleBreakdown: [
      { role: 'admin', count: 2, source: 'Default' },
      { role: 'readonly', count: 3, source: 'Group: Engineering' },
    ],
    onConfirm: vi.fn(),
    onBack: vi.fn(),
    isImporting: false,
  } as const;

  it('renders ready to import heading', () => {
    render(<ImportConfirmStep {...defaultProps} />);
    expect(screen.getByText(/Ready to import 5 users/)).toBeInTheDocument();
  });

  it('renders role breakdown items', () => {
    render(<ImportConfirmStep {...defaultProps} />);
    expect(screen.getAllByText(/\d+ as \w+/).length).toBe(2);
  });

  it('renders back and import buttons', () => {
    render(<ImportConfirmStep {...defaultProps} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText(/Import 5 users/)).toBeInTheDocument();
  });

  it('shows importing state', () => {
    render(<ImportConfirmStep {...defaultProps} isImporting={true} />);
    expect(screen.getByText('Importing users...')).toBeInTheDocument();
  });

  it('disables buttons during import', () => {
    render(<ImportConfirmStep {...defaultProps} isImporting={true} />);
    expect(screen.getByText('Back')).toBeDisabled();
    expect(screen.getByText('Importing users...')).toBeDisabled();
  });
});
