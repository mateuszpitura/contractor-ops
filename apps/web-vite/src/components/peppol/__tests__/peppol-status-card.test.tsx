/**
 * Step-10 port + decisive-container refactor. The container picks the variant
 * (loading skeleton / disconnected card / connected card); each sub-component
 * is asserted as a single-render-path view.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../peppol-wizard-container.js', () => ({
  PeppolWizardContainer: () => null,
}));

import { render, screen } from '../../../test/test-utils.js';
import type { PeppolStatusCardConnectedProps } from '../peppol-status-card.js';
import {
  PeppolStatusCardConnected,
  PeppolStatusCardDisconnected,
  PeppolStatusCardSkeleton,
} from '../peppol-status-card.js';

function makeConnectedProps(
  over: Partial<PeppolStatusCardConnectedProps> = {},
): PeppolStatusCardConnectedProps {
  return {
    participant: {
      participantId: '0184:NL000000001',
      aspProvider: 'storecove',
      status: 'ACTIVE',
    } as never,
    connection: { lastSyncAt: new Date('2026-04-10T00:00:00Z') } as never,
    counts: { sentTransmissions: 10, receivedTransmissions: 5, failedTransmissions: 1 } as never,
    onDisconnect: vi.fn(),
    isDisconnecting: false,
    ...over,
  };
}

describe('PeppolStatusCard sub-components (web-vite)', () => {
  it('skeleton renders multiple skeleton slots', () => {
    const { container } = render(<PeppolStatusCardSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('disconnected card exposes a Connect to Peppol button', () => {
    const onConnectClick = vi.fn();
    render(<PeppolStatusCardDisconnected onConnectClick={onConnectClick} />);
    expect(screen.getByRole('heading', { name: /Peppol Network/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect to Peppol/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Disconnected/i).length).toBeGreaterThan(0);
  });

  it('connected card renders participant details and metrics', () => {
    render(<PeppolStatusCardConnected {...makeConnectedProps()} />);
    expect(screen.getByText('0184:NL000000001')).toBeInTheDocument();
    expect(screen.getByText('storecove')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('connected card renders Settings and Disconnect actions', () => {
    render(<PeppolStatusCardConnected {...makeConnectedProps()} />);
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
  });
});
