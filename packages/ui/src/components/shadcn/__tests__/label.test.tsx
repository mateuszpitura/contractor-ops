import { render, screen } from '../../../__tests__/test-utils.js';
import { Label } from '../label.js';

describe('Label', () => {
  it('renders a label element', () => {
    render(<Label>Username</Label>);
    const el = screen.getByText('Username');
    expect(el.tagName).toBe('LABEL');
  });

  it('sets data-slot=label', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toHaveAttribute('data-slot', 'label');
  });

  it('forwards htmlFor prop', () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email');
  });

  it('merges custom className', () => {
    render(<Label className="required">Name</Label>);
    expect(screen.getByText('Name').className).toContain('required');
  });

  it('renders children elements', () => {
    render(
      <Label>
        <span data-testid="icon">*</span> Required
      </Label>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('forwards HTML attributes', () => {
    render(
      // biome-ignore lint/correctness/useUniqueElementIds: test render
      <Label data-testid="lbl" id="my-label">
        Test
      </Label>,
    );
    expect(screen.getByTestId('lbl')).toHaveAttribute('id', 'my-label');
  });
});
