/**
 * SendForSignatureButton calls `useSendForSignatureButton` directly (pure
 * derivation hook — no tRPC) and renders SendForSignatureDialog
 * (which IS a tRPC consumer). We mock the container to keep this test
 * scoped to the button surface.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('../send-for-signature-dialog.js', () => ({
  SendForSignatureDialog: () => null,
}));

import { SendForSignatureButton } from '../send-for-signature-button';

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

  it('shows button text (Send for Signature)', () => {
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
