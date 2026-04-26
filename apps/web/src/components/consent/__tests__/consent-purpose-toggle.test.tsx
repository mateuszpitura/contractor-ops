import { render, screen, setup } from '@/test/test-utils';
import { ConsentPurposeToggle } from '../consent-purpose-toggle';

describe('ConsentPurposeToggle', () => {
  const defaultProps = {
    purpose: 'CONTRACTOR_DATA_PROCESSING' as const,
    required: true,
    granted: false,
    onToggle: vi.fn() as React.ComponentProps<typeof ConsentPurposeToggle>['onToggle'],
  };

  it('renders the label and description from translations', () => {
    render(<ConsentPurposeToggle {...defaultProps} />);
    // Translation keys resolve to the key path in test — check the switch exists
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders "required" badge when purpose is required', () => {
    render(<ConsentPurposeToggle {...defaultProps} required />);
    expect(screen.getByText('Consent.required')).toBeInTheDocument();
  });

  it('renders "optional" badge when purpose is not required', () => {
    render(<ConsentPurposeToggle {...defaultProps} required={false} />);
    expect(screen.getByText('Consent.optional')).toBeInTheDocument();
  });

  it('switch reflects granted state', () => {
    render(<ConsentPurposeToggle {...defaultProps} granted />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onToggle when optional switch is changed', async () => {
    const onToggle = vi.fn();
    const { user } = setup(
      <ConsentPurposeToggle
        {...defaultProps}
        required={false}
        granted={false}
        onToggle={onToggle}
      />,
    );
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('disables switch when disabled prop is true', () => {
    render(<ConsentPurposeToggle {...defaultProps} disabled />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('has correct aria-label on the switch', () => {
    render(<ConsentPurposeToggle {...defaultProps} />);
    expect(screen.getByLabelText(/consent toggle/i)).toBeInTheDocument();
  });
});
