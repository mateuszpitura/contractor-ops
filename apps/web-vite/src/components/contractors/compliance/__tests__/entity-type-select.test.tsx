import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EntityTypeSelect } from '@/components/contractors/compliance/entity-type-select';
import { render, screen, within } from '@/test/test-utils';

const ENTITY_VALUES = ['GMBH', 'UG', 'AG'] as const;

function renderLabel(v: string): string {
  const labels: Record<string, string> = {
    GMBH: 'GmbH',
    UG: 'UG (haftungsbeschränkt)',
    AG: 'AG',
  };
  return labels[v] ?? v;
}

describe('EntityTypeSelect', () => {
  const defaultProps = {
    values: ENTITY_VALUES,
    value: undefined as string | undefined,
    onChange: vi.fn(),
    label: 'Entity type',
    renderOption: renderLabel,
  };

  it('renders a select element with a visible label', () => {
    render(<EntityTypeSelect {...defaultProps} />);
    expect(screen.getByLabelText('Entity type')).toBeInTheDocument();
  });

  it('renders a disabled placeholder option and all value options', () => {
    render(<EntityTypeSelect {...defaultProps} />);
    const select = screen.getByLabelText('Entity type');
    const options = within(select as HTMLElement).getAllByRole('option');
    // 1 placeholder + 3 values
    expect(options).toHaveLength(4);
  });

  it('renders options with labels from renderOption', () => {
    render(<EntityTypeSelect {...defaultProps} />);
    expect(screen.getByText('GmbH')).toBeInTheDocument();
    expect(screen.getByText('UG (haftungsbeschränkt)')).toBeInTheDocument();
    expect(screen.getByText('AG')).toBeInTheDocument();
  });

  it('calls onChange when a value is selected', () => {
    const onChange = vi.fn();
    render(<EntityTypeSelect {...defaultProps} onChange={onChange} />);
    const select = screen.getByLabelText('Entity type');
    fireEvent.change(select, { target: { value: 'GMBH' } });
    expect(onChange).toHaveBeenCalledWith('GMBH');
  });

  it('shows required indicator when required is true', () => {
    render(<EntityTypeSelect {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message and sets aria-invalid', () => {
    render(<EntityTypeSelect {...defaultProps} error="Please select a type" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a type');
    expect(screen.getByLabelText('Entity type')).toHaveAttribute('aria-invalid', 'true');
  });

  it('selects the correct option when value is provided', () => {
    render(<EntityTypeSelect {...defaultProps} value="UG" />);
    expect(screen.getByLabelText('Entity type')).toHaveValue('UG');
  });
});
