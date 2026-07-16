import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StatusReport } from '../status-view';
import { deriveOverall, StatusReportPanel, StatusView } from '../status-view';

function report(overrides: Partial<StatusReport> = {}): StatusReport {
  return {
    updatedAt: '2026-07-16T10:00:00Z',
    components: {
      api: { status: 'operational' },
      'webhooks-dispatcher': { status: 'operational' },
      'background-jobs': { status: 'operational' },
    },
    incidents: [],
    ...overrides,
  };
}

describe('deriveOverall', () => {
  it('is operational when every component is operational', () => {
    expect(deriveOverall(report())).toBe('operational');
  });

  it('is degraded when any component is degraded and none are down', () => {
    expect(
      deriveOverall(
        report({
          components: {
            api: { status: 'operational' },
            'webhooks-dispatcher': { status: 'degraded' },
            'background-jobs': { status: 'operational' },
          },
        }),
      ),
    ).toBe('degraded');
  });

  it('is down when any component is down', () => {
    expect(
      deriveOverall(
        report({
          components: {
            api: { status: 'down' },
            'webhooks-dispatcher': { status: 'degraded' },
            'background-jobs': { status: 'operational' },
          },
        }),
      ),
    ).toBe('down');
  });
});

describe('StatusReportPanel', () => {
  it('renders the operational headline and all three component labels', () => {
    render(<StatusReportPanel report={report()} />);
    expect(screen.getByText('All systems operational')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Webhook delivery')).toBeInTheDocument();
    expect(screen.getByText('Background jobs')).toBeInTheDocument();
    // The operational state appears as a text label, not color alone.
    expect(screen.getAllByText('Operational').length).toBe(3);
  });

  it('renders the degraded headline', () => {
    render(
      <StatusReportPanel
        report={report({
          components: {
            api: { status: 'operational' },
            'webhooks-dispatcher': { status: 'degraded' },
            'background-jobs': { status: 'operational' },
          },
        })}
      />,
    );
    expect(screen.getByText('Some systems degraded')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders the outage headline and the incident history when a service is down', () => {
    render(
      <StatusReportPanel
        report={report({
          components: {
            api: { status: 'down' },
            'webhooks-dispatcher': { status: 'operational' },
            'background-jobs': { status: 'operational' },
          },
          incidents: [
            {
              id: 'inc-1',
              title: 'API elevated error rate',
              status: 'OPEN',
              severity: 'CRITICAL',
              componentsAffected: ['api'],
              startedAt: '2026-07-16T09:30:00Z',
              latestUpdate: 'We are investigating.',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Active service outage')).toBeInTheDocument();
    expect(screen.getByText('API elevated error rate')).toBeInTheDocument();
    expect(screen.getByText('We are investigating.')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('shows the empty state when there are no incidents', () => {
    render(<StatusReportPanel report={report()} />);
    expect(screen.getByText('No incidents reported')).toBeInTheDocument();
  });
});

describe('StatusView (fetch-driven)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the panel once the status fetch resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(report()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<StatusView />);
    expect(await screen.findByText('All systems operational')).toBeInTheDocument();
  });

  it('renders an error alert when the status fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    render(<StatusView />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Status is temporarily unavailable')).toBeInTheDocument();
  });
});
