import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { EconomicDependencyInput } from '../economic-dependency-input';

describe('EconomicDependencyInput', () => {
  it('renders a labeled numeric input', () => {
    render(<EconomicDependencyInput name="eco" onCommit={vi.fn()} />);

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('displays help text', () => {
    render(<EconomicDependencyInput name="eco" onCommit={vi.fn()} />);

    // Help text is always rendered
    const helpSpans = document.querySelectorAll('span.text-xs');
    expect(helpSpans.length).toBeGreaterThan(0);
  });

  it('shows the initial value when provided', () => {
    render(<EconomicDependencyInput name="eco" value={75} onCommit={vi.fn()} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('75');
  });

  it('calls onCommit with parsed value on blur', async () => {
    const onCommit = vi.fn();
    const { user } = setup(<EconomicDependencyInput name="eco" onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton');
    await user.type(input, '42');
    await user.tab(); // blur

    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it('shows error for out-of-range values on blur', async () => {
    const onCommit = vi.fn();
    const { user } = setup(<EconomicDependencyInput name="eco" onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton');
    await user.type(input, '150');
    await user.tab();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('disables the input when disabled prop is true', () => {
    render(<EconomicDependencyInput name="eco" onCommit={vi.fn()} disabled />);

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('sets aria-invalid when there is an error', async () => {
    const { user } = setup(<EconomicDependencyInput name="eco" onCommit={vi.fn()} />);

    const input = screen.getByRole('spinbutton');
    await user.type(input, '999');
    await user.tab();

    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
