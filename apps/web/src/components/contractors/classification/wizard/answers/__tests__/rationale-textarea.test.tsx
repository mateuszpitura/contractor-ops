import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { RationaleTextarea } from '../rationale-textarea';

describe('RationaleTextarea', () => {
  it('renders the textarea with label and character counter', () => {
    const onChange = vi.fn();
    render(<RationaleTextarea name="rationale" value="" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // Label rendered
    expect(screen.getByText(/rationale/i)).toBeInTheDocument();
  });

  it('displays the current character count', () => {
    const onChange = vi.fn();
    render(<RationaleTextarea name="rationale" value="hello" onChange={onChange} />);

    // Counter should contain "5" and "1000"
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
    const onChange = vi.fn();
    render(<RationaleTextarea name="rationale" value="" onChange={onChange} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('sets maxLength to 1000', () => {
    const onChange = vi.fn();
    render(<RationaleTextarea name="rationale" value="" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '1000');
  });
});
