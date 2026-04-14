import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { TransmissionSection } from '../transmission-section';

describe('TransmissionSection', () => {
  it('renders event log in the order provided (caller orders by createdAt desc)', () => {
    render(
      <TransmissionSection
        lifecycle={{
          id: 'lc_1',
          validationStatus: 'VALID',
          transmissionStatus: 'SENT',
          transmissionId: 'msg_xyz',
          events: [
            { id: 'e1', eventType: 'SENT', createdAt: '2026-04-02T10:00:00Z' },
            { id: 'e2', eventType: 'FINALIZED', createdAt: '2026-04-01T09:00:00Z' },
          ],
        }}
        peppolParticipant={{ status: 'ACTIVE' }}
        receiverAcceptsXRechnungCii={true}
        isSendPending={false}
        onSend={vi.fn()}
      />,
    );

    const rows = document.querySelectorAll('[data-slot=transmission-event-row]');
    expect(rows).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Transmission history' })).toBeInTheDocument();
  });

  it('renders NOT_SENT empty state with accessible status pill', () => {
    render(
      <TransmissionSection
        lifecycle={null}
        peppolParticipant={null}
        receiverAcceptsXRechnungCii={false}
        isSendPending={false}
        onSend={vi.fn()}
      />,
    );

    expect(
      screen.getByText('This e-invoice has not been transmitted.'),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-slot=transmission-status-pill]')?.textContent).toBe(
      'NOT_SENT',
    );
  });
});
