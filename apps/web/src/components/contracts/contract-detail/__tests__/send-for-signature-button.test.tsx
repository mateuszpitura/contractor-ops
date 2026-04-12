import { render, screen } from '@/test/test-utils';
import { SendForSignatureButton } from '../send-for-signature-button';

vi.mock('../send-for-signature-dialog', () => ({
  SendForSignatureDialog: () => null,
}));

describe('SendForSignatureButton', () => {
  it('returns null for non-DRAFT/ACTIVE statuses', () => {
    const { container } = render(
      <SendForSignatureButton
        contractId="ct1"
        contractStatus="TERMINATED"
        hasDocument={true}
        hasConnectedProvider={true}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders disabled button when no document', () => {
    render(
      <SendForSignatureButton
        contractId="ct1"
        contractStatus="DRAFT"
        hasDocument={false}
        hasConnectedProvider={true}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders disabled button when no provider', () => {
    render(
      <SendForSignatureButton
        contractId="ct1"
        contractStatus="DRAFT"
        hasDocument={true}
        hasConnectedProvider={false}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders enabled button when document and provider available', () => {
    render(
      <SendForSignatureButton
        contractId="ct1"
        contractStatus="ACTIVE"
        hasDocument={true}
        hasConnectedProvider={true}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('shows button text', () => {
    render(
      <SendForSignatureButton
        contractId="ct1"
        contractStatus="DRAFT"
        hasDocument={true}
        hasConnectedProvider={true}
      />,
    );
    expect(screen.getByText('Send for Signature')).toBeInTheDocument();
  });
});
