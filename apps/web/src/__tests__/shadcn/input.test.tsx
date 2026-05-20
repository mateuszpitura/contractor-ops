import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { render, screen, setup } from '@/test/test-utils';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input aria-label="test" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('sets data-slot=input', () => {
    render(<Input aria-label="test" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-slot', 'input');
  });

  it('forwards the type prop', () => {
    render(<Input type="email" aria-label="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('renders a password input', () => {
    render(<Input type="password" data-testid="pw" />);
    expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password');
  });

  it('forwards placeholder', () => {
    render(<Input placeholder="Enter value" aria-label="val" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<Input aria-label="test" className="w-full" />);
    expect(screen.getByRole('textbox').className).toContain('w-full');
  });

  it('handles disabled state', () => {
    render(<Input aria-label="test" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('accepts user input', async () => {
    const { user } = setup(<Input aria-label="test" />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });

  it('calls onChange handler', async () => {
    const onChange = vi.fn();
    const { user } = setup(<Input aria-label="test" onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards aria-invalid', () => {
    render(<Input aria-label="test" aria-invalid="true" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
