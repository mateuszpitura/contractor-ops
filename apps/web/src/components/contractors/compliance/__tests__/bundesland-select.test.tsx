import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BundeslandSelect } from '@/components/contractors/compliance/bundesland-select';
import { render, screen, within } from '@/test/test-utils';

describe('BundeslandSelect', () => {
  const defaultProps = {
    value: undefined as 'BW' | undefined,
    onChange: vi.fn(),
    label: 'Bundesland',
  };

  it('renders a select element with a visible label', () => {
    render(<BundeslandSelect {...defaultProps} />);
    expect(screen.getByLabelText('Bundesland')).toBeInTheDocument();
  });

  it('renders exactly 16 options for each German federal state', () => {
    render(<BundeslandSelect {...defaultProps} />);
    const select = screen.getByLabelText('Bundesland');
    const options = within(select as HTMLElement).getAllByRole('option');
    expect(options).toHaveLength(16);
  });

  it('sorts options alphabetically by German name', () => {
    render(<BundeslandSelect {...defaultProps} />);
    const select = screen.getByLabelText('Bundesland');
    const options = within(select as HTMLElement).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Baden-Württemberg');
    expect(options[options.length - 1]).toHaveTextContent('Thüringen');
  });

  it('calls onChange when a state is selected', () => {
    const onChange = vi.fn();
    render(<BundeslandSelect {...defaultProps} onChange={onChange} />);
    const select = screen.getByLabelText('Bundesland');
    fireEvent.change(select, { target: { value: 'BY' } });
    expect(onChange).toHaveBeenCalledWith('BY');
  });

  it('shows required indicator when required is true', () => {
    render(<BundeslandSelect {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays an error message when error prop is set', () => {
    render(<BundeslandSelect {...defaultProps} error="Required field" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required field');
  });

  it('marks the select as aria-invalid when there is an error', () => {
    render(<BundeslandSelect {...defaultProps} error="Required field" />);
    expect(screen.getByLabelText('Bundesland')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the select when disabled is true', () => {
    render(<BundeslandSelect {...defaultProps} disabled />);
    expect(screen.getByLabelText('Bundesland')).toBeDisabled();
  });
});
