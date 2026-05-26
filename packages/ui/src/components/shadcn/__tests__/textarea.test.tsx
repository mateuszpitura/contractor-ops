import { render, screen, setup } from '../../../__tests__/test-utils.js';
import { Textarea } from '../textarea.js';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea aria-label="notes" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('sets data-slot=textarea', () => {
    render(<Textarea aria-label="notes" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-slot', 'textarea');
  });

  it('forwards placeholder', () => {
    render(<Textarea placeholder="Type here..." aria-label="notes" />);
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<Textarea aria-label="notes" className="h-40" />);
    expect(screen.getByRole('textbox').className).toContain('h-40');
  });

  it('handles disabled state', () => {
    render(<Textarea aria-label="notes" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('accepts user input', async () => {
    const { user } = setup(<Textarea aria-label="notes" />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world');
    expect(textarea).toHaveValue('Hello world');
  });

  it('forwards rows prop', () => {
    render(<Textarea aria-label="notes" rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('forwards aria-invalid', () => {
    render(<Textarea aria-label="notes" aria-invalid="true" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
