/**
 * SendForSignatureDialog is presentational; `dialog` prop is
 * produced by `useSendForSignatureDialog`. We construct shaped stubs to
 * exercise each render branch without a tRPC harness.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { SendForSignatureDialog } from '../send-for-signature-dialog';

type Props = Parameters<typeof SendForSignatureDialog>[0];

function makeDialog(overrides: Partial<Props['dialog']> = {}): Props['dialog'] {
  return {
    addCountersigner: vi.fn(),
    connectionsLoading: false,
    esignConnections: [],
    expiresInDays: '14',
    handleDiscard: vi.fn(),
    handleDragEnd: vi.fn(),
    handleSubmit: vi.fn(),
    isSendPending: false,
    message: '',
    reminderInterval: '7',
    selectedConnectionId: '',
    setExpiresInDays: vi.fn(),
    setMessage: vi.fn(),
    setReminderInterval: vi.fn(),
    setSelectedConnectionId: vi.fn(),
    signers: [],
    ...overrides,
  } as Props['dialog'];
}

const baseProps: Omit<Props, 'dialog'> = {
  open: true,
  onOpenChange: vi.fn(),
  contractId: 'ct1',
  documentId: 'doc1',
  contractParties: [{ name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' }],
};

const baseSigner = {
  id: 's1',
  name: 'Jan Kowalski',
  email: 'jan@test.com',
  role: 'signer' as const,
};

describe('SendForSignatureDialog', () => {
  it('renders dialog when open', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
  });

  it('does not render when closed', () => {
    render(<SendForSignatureDialog {...baseProps} open={false} dialog={makeDialog()} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders signer row name and email', () => {
    render(
      <SendForSignatureDialog {...baseProps} dialog={makeDialog({ signers: [baseSigner] })} />,
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('jan@test.com')).toBeInTheDocument();
  });

  it('renders multiple signers', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({
          signers: [
            baseSigner,
            { id: 's2', name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
  });

  it('renders signer role badges', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({
          signers: [
            baseSigner,
            { id: 's2', name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Contractor')).toBeInTheDocument();
    expect(screen.getByText('Countersigner')).toBeInTheDocument();
  });

  it('renders no signers text when signers list is empty', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getByText(/no signers/i)).toBeInTheDocument();
  });

  it('shows add countersigner link when no countersigner exists', () => {
    render(
      <SendForSignatureDialog {...baseProps} dialog={makeDialog({ signers: [baseSigner] })} />,
    );
    expect(screen.getByText(/add countersigner/i)).toBeInTheDocument();
  });

  it('hides add countersigner link when a countersigner already exists', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({
          signers: [
            baseSigner,
            { id: 's2', name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
          ],
        })}
      />,
    );
    expect(screen.queryByText(/add countersigner/i)).not.toBeInTheDocument();
  });

  it('invokes dialog.addCountersigner when add countersigner link is clicked', async () => {
    const addCountersigner = vi.fn();
    const { user } = setup(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({ signers: [baseSigner], addCountersigner })}
      />,
    );
    await user.click(screen.getByText(/add countersigner/i));
    expect(addCountersigner).toHaveBeenCalledTimes(1);
  });

  it('renders provider section label', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  it('send button is disabled when no provider is selected', () => {
    render(
      <SendForSignatureDialog {...baseProps} dialog={makeDialog({ signers: [baseSigner] })} />,
    );
    const sendBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Send'));
    expect(sendBtn).toBeDisabled();
  });

  it('send button is disabled when no signers', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({ selectedConnectionId: 'conn1' })}
      />,
    );
    const sendBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Send'));
    expect(sendBtn).toBeDisabled();
  });

  it('renders message textarea', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls dialog.setMessage when typing in the message field', async () => {
    const setMessage = vi.fn();
    const { user } = setup(
      <SendForSignatureDialog {...baseProps} dialog={makeDialog({ setMessage })} />,
    );
    await user.type(screen.getByRole('textbox'), 'X');
    expect(setMessage).toHaveBeenCalled();
  });

  it('renders document section with document ID', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getByText('doc1')).toBeInTheDocument();
  });

  it('invokes dialog.handleDiscard when Discard is clicked', async () => {
    const handleDiscard = vi.fn();
    const { user } = setup(
      <SendForSignatureDialog {...baseProps} dialog={makeDialog({ handleDiscard })} />,
    );
    await user.click(screen.getByText('Discard'));
    expect(handleDiscard).toHaveBeenCalledTimes(1);
  });

  it('starts with empty message textarea by default', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('shows the sending state when isSendPending is true', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({
          signers: [baseSigner],
          selectedConnectionId: 'conn1',
          isSendPending: true,
        })}
      />,
    );
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
  });

  it('renders the send button', () => {
    render(<SendForSignatureDialog {...baseProps} dialog={makeDialog()} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('renders three signers correctly', () => {
    render(
      <SendForSignatureDialog
        {...baseProps}
        dialog={makeDialog({
          signers: [
            baseSigner,
            { id: 's2', name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
            { id: 's3', name: 'Piotr Krawczyk', email: 'piotr@test.com', role: 'signer' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('Piotr Krawczyk')).toBeInTheDocument();
  });
});
