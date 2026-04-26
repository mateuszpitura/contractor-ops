import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/validators', () => ({
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar',
}));

import { render, screen, setup } from '@/test/test-utils';

import { Score03Answer } from '../score-03-answer';

describe('Score03Answer', () => {
  it('renders four radio options (0, 1, 2, 3)', () => {
    const onChange = vi.fn();
    render(<Score03Answer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('displays score labels for each option', () => {
    const onChange = vi.fn();
    render(<Score03Answer name="q1" onChange={onChange} />);

    // Transport values 0, 1, 2, 3 should be rendered
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onChange with isNotApplicable payload when 0 is selected', async () => {
    const onChange = vi.fn();
    const { user } = setup(<Score03Answer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);

    expect(onChange).toHaveBeenCalledWith({ rawScore: 0, isNotApplicable: true });
  });

  it('calls onChange with scored payload when 2 is selected', async () => {
    const onChange = vi.fn();
    const { user } = setup(<Score03Answer name="q1" onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    await user.click(radios[2]);

    expect(onChange).toHaveBeenCalledWith({ rawScore: 2, isNotApplicable: false });
  });

  it('disables all radios when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<Score03Answer name="q1" onChange={onChange} disabled />);

    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
