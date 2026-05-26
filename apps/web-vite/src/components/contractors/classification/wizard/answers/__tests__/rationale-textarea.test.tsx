/**
 * web-vite port. Pure-prop textarea; no tRPC dependency.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../../../test/test-utils.js';
import { RationaleTextarea } from '../rationale-textarea.js';

describe('RationaleTextarea', () => {
  it('renders the textarea with label and character counter', () => {
    render(<RationaleTextarea name="rationale" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/rationale/i)).toBeInTheDocument();
  });

  it('displays the current character count', () => {
    render(<RationaleTextarea name="rationale" value="hello" onChange={vi.fn()} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('calls onChange when the user types', async () => {
    const onChange = vi.fn();
    const { user } = setup(<RationaleTextarea name="rationale" value="" onChange={onChange} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('disables the textarea when disabled prop is true', () => {
    render(<RationaleTextarea name="rationale" value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('sets maxLength to 1000', () => {
    render(<RationaleTextarea name="rationale" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '1000');
  });
});
