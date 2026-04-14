import { render, screen, setup } from '@/test/test-utils';
import { PrivacyNoticeAcknowledgement } from '../privacy-notice-acknowledgement';

describe('PrivacyNoticeAcknowledgement', () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
    jurisdictionUrl: '/en/legal/privacy/gb',
  };

  it('renders the checkbox', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('checkbox reflects checked state', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders a link to the jurisdiction privacy notice', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/en/legal/privacy/gb');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onChange when checkbox is toggled', async () => {
    const onChange = vi.fn();
    const { user } = setup(<PrivacyNoticeAcknowledgement {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders error message when error prop is set', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} error="You must acknowledge" />);
    expect(screen.getByText('You must acknowledge')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not render error when error prop is absent', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sets aria-required on the checkbox', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
  });

  it('sets aria-invalid when error is present', () => {
    render(<PrivacyNoticeAcknowledgement {...defaultProps} error="Required" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
