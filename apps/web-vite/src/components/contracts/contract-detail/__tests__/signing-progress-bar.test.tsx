/**
 * Ported from apps/web/src/components/contracts/contract-detail/__tests__/signing-progress-bar.test.tsx.
 *
 * Web-vite split: SigningProgressBar is presentational; `signing` prop is
 * produced by `useSigningProgressBar`, and audit/void dialogs are controlled
 * by parent state.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { SigningProgressBar } from '../signing-progress-bar';

type Props = Parameters<typeof SigningProgressBar>[0];

function makeSigning(overrides: Partial<Props['signing']> = {}): Props['signing'] {
  return {
    resendToRecipient: vi.fn(),
    isResendPending: false,
    invalidateAfterVoid: vi.fn(),
    ...overrides,
  };
}

const envelope = {
  id: 'env1',
  status: 'SENT',
  recipients: [
    {
      id: 'r1',
      name: 'Jan',
      email: 'jan@test.com',
      role: 'signer',
      status: 'SIGNED',
      routingOrder: 1,
    },
    {
      id: 'r2',
      name: 'Anna',
      email: 'anna@test.com',
      role: 'countersigner',
      status: 'PENDING',
      routingOrder: 2,
    },
  ],
};

describe('SigningProgressBar', () => {
  it('renders without crashing for a mixed-status envelope', () => {
    const { container } = render(
      <SigningProgressBar
        envelope={envelope}
        signing={makeSigning()}
        auditOpen={false}
        onAuditOpenChange={vi.fn()}
        onVoidOpen={vi.fn()}
      />,
    );
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('shows the signed-count status text (1 of 2)', () => {
    render(
      <SigningProgressBar
        envelope={envelope}
        signing={makeSigning()}
        auditOpen={false}
        onAuditOpenChange={vi.fn()}
        onVoidOpen={vi.fn()}
      />,
    );
    expect(screen.getByText(/waiting for anna/i)).toBeInTheDocument();
  });

  it('shows "all signed" copy when every recipient signed', () => {
    render(
      <SigningProgressBar
        envelope={{
          ...envelope,
          recipients: envelope.recipients.map(r => ({ ...r, status: 'SIGNED' })),
        }}
        signing={makeSigning()}
        auditOpen={false}
        onAuditOpenChange={vi.fn()}
        onVoidOpen={vi.fn()}
      />,
    );
    expect(screen.getByText(/all parties have signed/i)).toBeInTheDocument();
  });

  it('renders the View Signing History button', () => {
    render(
      <SigningProgressBar
        envelope={envelope}
        signing={makeSigning()}
        auditOpen={false}
        onAuditOpenChange={vi.fn()}
        onVoidOpen={vi.fn()}
      />,
    );
    expect(screen.getByText(/view signing history/i)).toBeInTheDocument();
  });

  it('invokes onAuditOpenChange(true) when view history is clicked', async () => {
    const onAuditOpenChange = vi.fn();
    const { user } = setup(
      <SigningProgressBar
        envelope={envelope}
        signing={makeSigning()}
        auditOpen={false}
        onAuditOpenChange={onAuditOpenChange}
        onVoidOpen={vi.fn()}
      />,
    );
    await user.click(screen.getByText(/view signing history/i));
    expect(onAuditOpenChange).toHaveBeenCalledWith(true);
  });
});
