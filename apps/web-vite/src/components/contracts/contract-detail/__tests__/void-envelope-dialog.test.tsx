/**
 * VoidEnvelopeDialog is presentational; `voidDialog` prop is
 * produced by `useVoidEnvelopeDialog`. We supply a shaped stub.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { VoidEnvelopeDialog } from '../void-envelope-dialog';

type Props = Parameters<typeof VoidEnvelopeDialog>[0];

function makeVoidDialog(overrides: Partial<Props['voidDialog']> = {}): Props['voidDialog'] {
  return {
    reason: '',
    setReason: vi.fn(),
    handleConfirm: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

describe('VoidEnvelopeDialog', () => {
  const baseProps: Omit<Props, 'voidDialog'> = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders dialog when open', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders reason textarea', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('renders cancel and void buttons', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render when closed', () => {
    render(<VoidEnvelopeDialog {...baseProps} open={false} voidDialog={makeVoidDialog()} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders reason label', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('renders dialog description', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    const descriptions = screen.getAllByText(/void/i);
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it('calls setReason when typing in the textarea', async () => {
    const setReason = vi.fn();
    const { user } = setup(
      <VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog({ setReason })} />,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'X');
    expect(setReason).toHaveBeenCalled();
  });

  it('reflects controlled reason value', () => {
    render(
      <VoidEnvelopeDialog
        {...baseProps}
        voidDialog={makeVoidDialog({ reason: 'No longer needed' })}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('No longer needed');
  });

  it('renders reason placeholder text', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('placeholder');
  });

  it('shows the voiding state when isPending is true', () => {
    render(<VoidEnvelopeDialog {...baseProps} voidDialog={makeVoidDialog({ isPending: true })} />);
    expect(screen.getByText(/voiding/i)).toBeInTheDocument();
  });
});
