/**
 * web-vite port. SteuernummerInput is pure-prop; no tRPC needed. Note that
 * i18next-icu doesn't expand bare `{var}` placeholders, so we assert on the
 * static prefix of `formatHint` rather than the interpolated example.
 */

import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { SteuernummerInput } from '../steuernummer-input.js';

describe('SteuernummerInput', () => {
  const defaultProps = {
    bundesland: undefined as 'BW' | undefined,
    value: undefined as string | undefined,
    onChange: vi.fn(),
    label: 'Steuernummer',
  };

  it('renders an input with the provided label', () => {
    render(<SteuernummerInput {...defaultProps} />);
    expect(screen.getByLabelText('Steuernummer')).toBeInTheDocument();
  });

  it('is disabled when no Bundesland is selected', () => {
    render(<SteuernummerInput {...defaultProps} />);
    const input = screen.getByLabelText('Steuernummer');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Select Bundesland first');
  });

  it('is enabled when a Bundesland is provided', () => {
    render(<SteuernummerInput {...defaultProps} bundesland="BW" />);
    const input = screen.getByLabelText('Steuernummer');
    expect(input).not.toBeDisabled();
  });

  it('shows the Bundesland-specific placeholder when a state is selected', () => {
    render(<SteuernummerInput {...defaultProps} bundesland="BW" />);
    const input = screen.getByLabelText('Steuernummer');
    expect(input).toHaveAttribute('placeholder', '93/815/08152');
  });

  it('renders the format hint paragraph for the selected Bundesland', () => {
    render(<SteuernummerInput {...defaultProps} bundesland="BW" />);
    expect(screen.getByText(/^Format:/)).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    const { user } = setup(
      <SteuernummerInput {...defaultProps} bundesland="BW" onChange={onChange} />,
    );
    const input = screen.getByLabelText('Steuernummer');
    await user.type(input, '93');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows required indicator when required is true', () => {
    render(<SteuernummerInput {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays external error from props', () => {
    render(<SteuernummerInput {...defaultProps} error="Invalid number" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid number');
  });

  it('shows local validation error on blur with an invalid value', () => {
    render(<SteuernummerInput {...defaultProps} bundesland="BW" value="123" />);
    const input = screen.getByLabelText('Steuernummer');
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(/does not match/);
  });

  it('does not show validation error on blur with a valid value', () => {
    render(<SteuernummerInput {...defaultProps} bundesland="BW" value="93/815/08152" />);
    const input = screen.getByLabelText('Steuernummer');
    fireEvent.blur(input);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
