/**
 * Step-10 port + decisive-container refactor. The container picks the variant
 * (failed vs success/pending) so views become single-render-path. Each
 * sub-component is asserted separately; we still exercise expand interaction
 * via the Collapsible trigger.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../test/test-utils.js';
import {
  PeppolTransmissionTimeline,
  PeppolTransmissionTimelineFailed,
} from '../peppol-transmission-status.js';

describe('PeppolTransmissionTimeline (web-vite)', () => {
  it('renders the title and Delivered badge in the trigger', () => {
    render(
      <PeppolTransmissionTimeline
        transmission={{
          id: 'tx-1',
          status: 'DELIVERED',
          aspTransmissionId: 'ASP-123',
          transmittedAt: '2026-04-15T10:00:00Z',
          deliveredAt: '2026-04-15T10:05:00Z',
          createdAt: '2026-04-15T09:55:00Z',
          errorMessage: null,
        }}
      />,
    );
    expect(screen.getByText('Peppol Transmission')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });
});

describe('PeppolTransmissionTimelineFailed (web-vite)', () => {
  it('renders a Failed badge in the trigger', () => {
    render(
      <PeppolTransmissionTimelineFailed
        transmission={{
          id: 'tx-2',
          status: 'FAILED',
          aspTransmissionId: null,
          transmittedAt: null,
          deliveredAt: null,
          createdAt: '2026-04-15T09:55:00Z',
          errorMessage: 'Network timeout',
        }}
        onRetry={vi.fn()}
        isRetrying={false}
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('reveals timeline, error message, and retry button when expanded', async () => {
    const onRetry = vi.fn();
    const { user } = setup(
      <PeppolTransmissionTimelineFailed
        transmission={{
          id: 'tx-3',
          status: 'FAILED',
          aspTransmissionId: 'ASP-999',
          transmittedAt: null,
          deliveredAt: null,
          createdAt: '2026-04-15T09:55:00Z',
          errorMessage: 'Bad request',
        }}
        onRetry={onRetry}
        isRetrying={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Peppol Transmission/i }));
    expect(screen.getByText('Bad request')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /Retry Transmission/i });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a Retrying label when isRetrying is true', async () => {
    const { user } = setup(
      <PeppolTransmissionTimelineFailed
        transmission={{
          id: 'tx-4',
          status: 'FAILED',
          aspTransmissionId: null,
          transmittedAt: null,
          deliveredAt: null,
          createdAt: '2026-04-15T09:55:00Z',
          errorMessage: 'X',
        }}
        onRetry={vi.fn()}
        isRetrying={true}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Peppol Transmission/i }));
    expect(screen.getByText(/Retrying/i)).toBeInTheDocument();
  });
});
