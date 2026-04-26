import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

// Mock the card components to keep this page test focused on composition.
vi.mock('@/components/settings/e-invoicing/peppol-participant-card', () => ({
  PeppolParticipantCard: () => (
    <div data-testid="peppol-participant-card">peppol-participant-card-stub</div>
  ),
}));

vi.mock('@/components/settings/e-invoicing/leitweg-id-list-card', () => ({
  LeitwegIdListCard: () => <div data-testid="leitweg-id-list-card">leitweg-id-list-card-stub</div>,
}));

import EInvoicingSettingsPage from '../page';

describe('Settings → E-invoicing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading + subline', () => {
    render(<EInvoicingSettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'E-invoicing' })).toBeInTheDocument();
    expect(screen.getByText(/Manage your Peppol participant registration/i)).toBeInTheDocument();
  });

  it('renders breadcrumb leading back to Settings', () => {
    render(<EInvoicingSettingsPage />);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  });

  it('composes PeppolParticipantCard + LeitwegIdListCard', () => {
    render(<EInvoicingSettingsPage />);
    expect(screen.getByTestId('peppol-participant-card')).toBeInTheDocument();
    expect(screen.getByTestId('leitweg-id-list-card')).toBeInTheDocument();
  });
});
