import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { LikertAnswer } from '../likert-answer';

describe('LikertAnswer', () => {
  it('renders five radio options for the likert scale', () => {
    const onChange = vi.fn();
    render(<LikertAnswer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
  });

  it('calls onChange with the numeric value when a radio is clicked', async () => {
    const onChange = vi.fn();
    const { user } = setup(<LikertAnswer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    await user.click(radios[2]); // 3rd option = value 3

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('marks the correct radio when value is provided', () => {
    const onChange = vi.fn();
    render(<LikertAnswer name="q1" value={4} onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    const checked = radios.find(r => r.getAttribute('aria-checked') === 'true');
    expect(checked).toBeTruthy();
  });

  it('disables all radios when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<LikertAnswer name="q1" onChange={onChange} disabled />);

    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
