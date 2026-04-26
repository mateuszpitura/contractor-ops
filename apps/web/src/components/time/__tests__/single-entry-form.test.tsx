import { describe, expect, it, vi } from 'vitest';
import { screen, setup } from '@/test/test-utils';
import { SingleEntryForm } from '../single-entry-form';

const contracts = [
  { id: 'c-1', title: 'Project Alpha' },
  { id: 'c-2', title: 'Project Beta' },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  contracts,
  onSubmit: vi.fn(),
  isSubmitting: false,
};

describe('SingleEntryForm', () => {
  it('renders dialog title', () => {
    setup(<SingleEntryForm {...defaultProps} />);
    expect(screen.getByText('Log Time Entry')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    setup(<SingleEntryForm {...defaultProps} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText(/Description/)).toBeInTheDocument();
  });

  it('renders Add Entry and Discard Entry buttons', () => {
    setup(<SingleEntryForm {...defaultProps} />);
    expect(screen.getByText('Add Entry')).toBeInTheDocument();
    expect(screen.getByText('Discard Entry')).toBeInTheDocument();
  });

  it('shows Adding... when submitting', () => {
    setup(<SingleEntryForm {...defaultProps} isSubmitting />);
    expect(screen.getByText('Adding...')).toBeInTheDocument();
  });

  it('shows validation errors when submitting with empty fields', async () => {
    const { user } = setup(<SingleEntryForm {...defaultProps} />);
    await user.click(screen.getByText('Add Entry'));
    expect(screen.getByText('Project is required')).toBeInTheDocument();
    expect(screen.getByText('Hours must be between 0.25 and 24')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) on discard', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<SingleEntryForm {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByText('Discard Entry'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders hours input with step 0.25', () => {
    setup(<SingleEntryForm {...defaultProps} />);
    const input = screen.getByLabelText('Hours');
    expect(input).toHaveAttribute('step', '0.25');
    expect(input).toHaveAttribute('min', '0.25');
    expect(input).toHaveAttribute('max', '24');
  });
});
