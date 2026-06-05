/**
 * SigningAuditTrail is presentational; `audit` prop is
 * produced by `useSigningAuditTrail`. We pass shaped stubs (no tRPC needed).
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { SigningAuditTrail } from '../signing-audit-trail';

type Props = Parameters<typeof SigningAuditTrail>[0];

function makeAudit(overrides: Partial<Props['audit']> = {}): Props['audit'] {
  return {
    events: [],
    isLoading: false,
    ...overrides,
  };
}

describe('SigningAuditTrail', () => {
  it('renders empty state when no events', () => {
    render(<SigningAuditTrail open={true} onOpenChange={vi.fn()} audit={makeAudit()} />);
    expect(screen.getByText('No Signing History')).toBeInTheDocument();
  });

  it('renders events when data is available', () => {
    render(
      <SigningAuditTrail
        open={true}
        onOpenChange={vi.fn()}
        audit={makeAudit({
          events: [
            {
              id: 'e1',
              eventType: 'ENVELOPE_SENT',
              description: 'Envelope sent to signer',
              actorName: 'Jan',
              occurredAt: new Date().toISOString(),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Envelope sent to signer')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  it('renders skeletons while loading', () => {
    render(
      <SigningAuditTrail
        open={true}
        onOpenChange={vi.fn()}
        audit={makeAudit({ isLoading: true })}
      />,
    );
    // Sheet content portals out of the test container; query the whole body.
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders multiple events', () => {
    render(
      <SigningAuditTrail
        open={true}
        onOpenChange={vi.fn()}
        audit={makeAudit({
          events: [
            {
              id: 'e1',
              eventType: 'ENVELOPE_CREATED',
              description: 'Envelope created',
              actorName: null,
              occurredAt: new Date().toISOString(),
            },
            {
              id: 'e2',
              eventType: 'RECIPIENT_SIGNED',
              description: 'Signed by Anna',
              actorName: 'Anna',
              occurredAt: new Date().toISOString(),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Envelope created')).toBeInTheDocument();
    expect(screen.getByText('Signed by Anna')).toBeInTheDocument();
  });
});
