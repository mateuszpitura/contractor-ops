import { render, screen, setup } from '@/test/test-utils';
import type { Condition } from '../condition-builder';
import { ConditionBuilder } from '../condition-builder';

describe('ConditionBuilder', () => {
  const onChange = vi.fn();

  it('renders add condition button when empty', () => {
    render(<ConditionBuilder value={[]} onChange={onChange} />);
    expect(screen.getByText('Add condition')).toBeInTheDocument();
  });

  it('renders existing conditions', () => {
    const conditions: Condition[] = [{ field: 'amount', operator: 'gt', value: 1000 }];
    render(<ConditionBuilder value={conditions} onChange={onChange} />);
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
  });

  it('calls onChange when add button is clicked', async () => {
    const { user } = setup(<ConditionBuilder value={[]} onChange={onChange} />);
    await user.click(screen.getByText('Add condition'));
    expect(onChange).toHaveBeenCalledWith([{ field: 'amount', operator: 'gt', value: '' }]);
  });

  it('renders remove button for each condition', () => {
    const conditions: Condition[] = [
      { field: 'amount', operator: 'gt', value: 500 },
      { field: 'contractorType', operator: 'eq', value: 'B2B' },
    ];
    render(<ConditionBuilder value={conditions} onChange={onChange} />);
    const removeButtons = screen.getAllByRole('button', {
      name: 'Remove',
    });
    expect(removeButtons).toHaveLength(2);
  });

  it('calls onChange with condition removed when remove is clicked', async () => {
    const conditions: Condition[] = [{ field: 'amount', operator: 'gt', value: 500 }];
    const { user } = setup(<ConditionBuilder value={conditions} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows help text', () => {
    render(<ConditionBuilder value={[]} onChange={onChange} />);
    expect(
      screen.getByText(
        'When an invoice matches these conditions, this chain is used. Leave empty for the default chain.',
      ),
    ).toBeInTheDocument();
  });
});
