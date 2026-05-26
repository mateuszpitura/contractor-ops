/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/embedded-signing-modal.test.tsx.
 *
 * Web-vite split: EmbeddedSigningModal is presentational; `modal` prop holds
 * iframe ref, isPending, signingData. We supply shaped stubs.
 */

import { createRef } from 'react';
import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { EmbeddedSigningModal } from '../embedded-signing-modal';

type Props = Parameters<typeof EmbeddedSigningModal>[0];

function makeModal(overrides: Partial<Props['modal']> = {}): Props['modal'] {
  return {
    iframeRef: createRef<HTMLIFrameElement>(),
    isPending: true,
    signingData: undefined,
    ...overrides,
  } as Props['modal'];
}

const baseProps = {
  envelopeId: 'env1',
  recipientEmail: 'signer@example.com',
  documentTitle: 'Contract.pdf',
  provider: 'DOCUSIGN' as const,
  open: true,
  onOpenChange: vi.fn(),
  onComplete: vi.fn(),
};

describe('EmbeddedSigningModal', () => {
  it('returns null when not open', () => {
    const { container } = render(
      <EmbeddedSigningModal {...baseProps} open={false} modal={makeModal()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders document title in top bar when open', () => {
    render(<EmbeddedSigningModal {...baseProps} modal={makeModal()} />);
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<EmbeddedSigningModal {...baseProps} modal={makeModal()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows loading state when modal.isPending is true', () => {
    render(<EmbeddedSigningModal {...baseProps} modal={makeModal({ isPending: true })} />);
    expect(screen.getByText(/preparing/i)).toBeInTheDocument();
  });

  it('renders iframe when embedded signing URL is available', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        modal={makeModal({
          isPending: false,
          signingData: { embedded: true, url: 'https://sign.example.com/embed' },
        })}
      />,
    );
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toBe('https://sign.example.com/embed');
  });

  it('renders redirect fallback for non-embedded URL with AUTENTI provider', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        provider="AUTENTI"
        modal={makeModal({
          isPending: false,
          signingData: { embedded: false, url: 'https://sign.example.com/redirect' },
        })}
      />,
    );
    expect(screen.getByText('Autenti')).toBeInTheDocument();
  });

  it('renders redirect message for non-embedded URL', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        provider="AUTENTI"
        modal={makeModal({
          isPending: false,
          signingData: { embedded: false, url: 'https://sign.example.com/redirect' },
        })}
      />,
    );
    expect(screen.getByText(/continue.*autenti/i)).toBeInTheDocument();
    expect(screen.getByText(/return to contract/i)).toBeInTheDocument();
  });

  it('renders error state when no URL is available', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        modal={makeModal({
          isPending: false,
          signingData: { embedded: false, url: undefined },
        })}
      />,
    );
    expect(screen.getByText(/unable to load/i)).toBeInTheDocument();
    expect(screen.getByText(/return to contract/i)).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <EmbeddedSigningModal {...baseProps} onOpenChange={onOpenChange} modal={makeModal()} />,
    );
    await user.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders iframe with correct title attribute', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        modal={makeModal({
          isPending: false,
          signingData: { embedded: true, url: 'https://sign.example.com/embed' },
        })}
      />,
    );
    const iframe = document.querySelector('iframe');
    expect(iframe).toHaveAttribute('title');
  });

  it('renders redirect fallback with DOCUSIGN provider text', () => {
    render(
      <EmbeddedSigningModal
        {...baseProps}
        provider="DOCUSIGN"
        modal={makeModal({
          isPending: false,
          signingData: { embedded: false, url: 'https://sign.example.com/redirect' },
        })}
      />,
    );
    expect(screen.getByText('Complete Signing')).toBeInTheDocument();
  });
});
