import { describe, expect, it, vi } from 'vitest';

import { VatRegisteredToggle } from '@/components/contractors/compliance/vat-registered-toggle';
import { render, screen, setup } from '@/test/test-utils';

describe('VatRegisteredToggle', () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
    label: 'VAT registered',
  };

  it('renders the toggle with the provided label text', () => {
    render(<VatRegisteredToggle {...defaultProps} />);
    expect(screen.getByText('VAT registered')).toBeInTheDocument();
  });

  it('renders an accessible switch element', () => {
    render(<VatRegisteredToggle {...defaultProps} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects the unchecked state', () => {
    render(<VatRegisteredToggle {...defaultProps} checked={false} />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('reflects the checked state', () => {
    render(<VatRegisteredToggle {...defaultProps} checked />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('calls onChange when the switch is clicked', async () => {
    const onChange = vi.fn();
    const { user } = setup(<VatRegisteredToggle {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('toggles via clicking the label text', async () => {
    const onChange = vi.fn();
    const { user } = setup(<VatRegisteredToggle {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByText('VAT registered'));
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
