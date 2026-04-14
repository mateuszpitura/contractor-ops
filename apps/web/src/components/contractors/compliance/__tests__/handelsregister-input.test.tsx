import { describe, expect, it, vi } from 'vitest';

import { HandelsregisterInput } from '@/components/contractors/compliance/handelsregister-input';
import { render, screen, setup } from '@/test/test-utils';

describe('HandelsregisterInput', () => {
  const defaultProps = {
    value: undefined,
    onChange: vi.fn(),
    legend: 'Handelsregisternummer',
  };

  it('renders a fieldset with the provided legend', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    expect(screen.getByText('Handelsregisternummer')).toBeInTheDocument();
  });

  it('renders the court combobox trigger with placeholder text', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    expect(screen.getByRole('combobox', { name: /registry court/i })).toBeInTheDocument();
    expect(screen.getByText('Select court...')).toBeInTheDocument();
  });

  it('renders HRB and HRA radio options', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    expect(screen.getByRole('radio', { name: /HRB/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /HRA/i })).toBeInTheDocument();
  });

  it('defaults the register type radio to HRB', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    expect(screen.getByRole('radio', { name: /HRB/i })).toBeChecked();
  });

  it('renders the registry number input with numeric placeholder', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: /registry number/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', '123456');
  });

  it('renders the example hint text', () => {
    render(<HandelsregisterInput {...defaultProps} />);
    expect(screen.getByText(/Amtsgericht München · HRB · 123456/)).toBeInTheDocument();
  });

  it('shows the required indicator when required is true', () => {
    render(<HandelsregisterInput {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message when error prop is set', () => {
    render(<HandelsregisterInput {...defaultProps} error="Invalid entry" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid entry');
  });

  it('strips non-digit characters from number input', async () => {
    const onChange = vi.fn();
    const { user } = setup(<HandelsregisterInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: /registry number/i });
    await user.type(input, 'a1');
    // The component strips non-digits; only the '1' keystroke produces a value
    const digitCalls = onChange.mock.calls
      .map(c => c[0]?.number)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    expect(digitCalls.length).toBeGreaterThan(0);
    expect(digitCalls.every((n: string) => /^\d+$/.test(n))).toBe(true);
  });
});
