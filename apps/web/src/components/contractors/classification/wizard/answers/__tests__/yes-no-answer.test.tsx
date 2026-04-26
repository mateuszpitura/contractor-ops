import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { YesNoAnswer } from '../yes-no-answer';

describe('YesNoAnswer', () => {
  it('renders two radio options for yes and no', () => {
    const onChange = vi.fn();
    render(<YesNoAnswer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('displays translated yes and no labels', () => {
    const onChange = vi.fn();
    render(<YesNoAnswer name="q1" onChange={onChange} />);

    // The component uses Classification.yesNo.yes / .no translation keys
    expect(screen.getAllByRole('radio').length).toBe(2);
  });

  it('marks the correct radio as checked when value is provided', () => {
    const onChange = vi.fn();
    render(<YesNoAnswer name="q1" value="yes" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    const checkedRadio = radios.find(r => r.getAttribute('aria-checked') === 'true');
    expect(checkedRadio).toBeTruthy();
  });

  it('calls onChange with the selected value when a radio is clicked', async () => {
    const onChange = vi.fn();
    const { user } = setup(<YesNoAnswer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);

    expect(onChange).toHaveBeenCalled();
  });

  it('disables all radios when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<YesNoAnswer name="q1" onChange={onChange} disabled />);

    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
