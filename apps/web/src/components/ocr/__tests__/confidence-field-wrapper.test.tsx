import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ConfidenceFieldWrapper } from '../confidence-field-wrapper';

describe('ConfidenceFieldWrapper', () => {
  it('renders the label', () => {
    render(
      <ConfidenceFieldWrapper confidence={95} label="Invoice Number">
        <input />
      </ConfidenceFieldWrapper>,
    );
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <ConfidenceFieldWrapper confidence={80} label="Test">
        <span data-testid="child">Child content</span>
      </ConfidenceFieldWrapper>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies green border class for confidence > 90', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={95} label="High">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-s-green');
  });

  it('applies amber border class for confidence 70-90', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={80} label="Medium">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-s-amber');
  });

  it('applies destructive border class for confidence < 70', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={50} label="Low">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-s-destructive');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={95} label="Test" className="custom-class">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });

  it('applies amber for boundary confidence = 70', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={70} label="Boundary">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-s-amber');
  });

  it('applies amber for boundary confidence = 90', () => {
    const { container } = render(
      <ConfidenceFieldWrapper confidence={90} label="Boundary">
        <input />
      </ConfidenceFieldWrapper>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-s-amber');
  });
});
