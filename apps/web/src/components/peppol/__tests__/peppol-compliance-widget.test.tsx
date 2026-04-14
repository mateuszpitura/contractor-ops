import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('@contractor-ops/einvoice', () => ({
  complianceState: { notConnected: 'notConnected' },
}));

import { PeppolComplianceWidget } from '../peppol-compliance-widget';

describe('PeppolComplianceWidget', () => {
  it('renders the widget label', () => {
    render(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(screen.getByText('Peppol (UAE)')).toBeInTheDocument();
  });

  it('shows Active status label for active state', () => {
    render(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Onboarding status label', () => {
    render(<PeppolComplianceWidget status={{ state: 'onboarding', healthScore: 50 }} />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('shows Suspended status label', () => {
    render(<PeppolComplianceWidget status={{ state: 'suspended', healthScore: 0 }} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('shows Not Connected for notConnected state', () => {
    render(<PeppolComplianceWidget status={{ state: 'notConnected', healthScore: 0 }} />);
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
  });

  it('shows Unknown for unrecognized state', () => {
    render(<PeppolComplianceWidget status={{ state: 'banana', healthScore: 0 }} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders transmission counts when provided', () => {
    render(
      <PeppolComplianceWidget
        status={{ state: 'active', healthScore: 100 }}
        transmissionCounts={{ sent: 42, received: 17 }}
      />,
    );
    expect(screen.getByText('42 sent, 17 rcvd')).toBeInTheDocument();
  });

  it('does not render transmission counts when omitted', () => {
    render(<PeppolComplianceWidget status={{ state: 'active', healthScore: 100 }} />);
    expect(screen.queryByText(/sent/)).not.toBeInTheDocument();
  });
});
