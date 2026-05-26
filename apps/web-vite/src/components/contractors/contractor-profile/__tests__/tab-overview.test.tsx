/**
 * web-vite port. View takes `contractor` + `showPii` + `onSwitchTab` as props.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : String(v)),
    formatTime: (v: unknown) => (v == null ? '' : String(v)),
    formatDateTime: (v: unknown) => (v == null ? '' : String(v)),
  }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { TabOverviewContractor } from '../tab-overview.js';
import { TabOverviewView } from '../tab-overview.js';

const baseContractor: TabOverviewContractor = {
  id: 'c1',
  legalName: 'ACME Sp. z o.o.',
  displayName: 'ACME Corp',
  type: 'COMPANY',
  taxId: '1234567890',
  vatId: 'PL1234567890',
  registrationNumber: '123456789',
  email: 'contact@acme.pl',
  phone: '+48123456789',
  addressLine1: 'ul. Testowa 1',
  addressLine2: null,
  city: 'Warszawa',
  postalCode: '00-001',
  countryCode: 'PL',
  currency: 'PLN',
  customFieldsJson: { billingModel: 'HOURLY', rateValueMinor: 15000 },
  billingProfiles: [
    {
      id: 'bp1',
      legalEntityName: 'ACME',
      preferredCurrency: 'PLN',
      bankAccountMasked: 'PL** **** **** ****',
      paymentTermsDays: 30,
      isDefault: true,
    },
  ],
  contracts: [
    {
      id: 'ct1',
      title: 'B2B Agreement',
      type: 'B2B_MASTER_SERVICE',
      status: 'ACTIVE',
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      billingModel: 'HOURLY',
    },
  ],
  complianceHealth: {
    overall: 'green',
    factors: [
      { key: 'documents', status: 'green', label: 'Documents' },
      { key: 'contract', status: 'green', label: 'Contract' },
    ],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

function renderTab(overrides: Partial<TabOverviewContractor> = {}, showPii = true) {
  return render(
    <TabOverviewView
      contractor={{ ...baseContractor, ...overrides }}
      showPii={showPii}
      onSwitchTab={vi.fn()}
    />,
  );
}

describe('TabOverviewView', () => {
  it('renders legal + display name', () => {
    renderTab();
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
  });

  it('renders email as a mailto link', () => {
    renderTab();
    const emailLink = screen.getByText('contact@acme.pl');
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:contact@acme.pl');
  });

  it('renders active contract info', () => {
    renderTab();
    expect(screen.getByText('B2B Agreement')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders phone number', () => {
    renderTab();
    expect(screen.getByText('+48123456789')).toBeInTheDocument();
  });

  it('renders address line', () => {
    renderTab();
    expect(screen.getByText(/ul\. Testowa 1/)).toBeInTheDocument();
  });

  it('renders currency in billing card', () => {
    renderTab();
    expect(screen.getByText('PLN')).toBeInTheDocument();
  });

  it('renders billing model from custom fields', () => {
    renderTab();
    expect(screen.getByText('HOURLY')).toBeInTheDocument();
  });

  it('renders country code field', () => {
    renderTab();
    expect(screen.getByText('PL')).toBeInTheDocument();
  });

  it('renders health card with at least 2 factor buttons', () => {
    renderTab();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('renders no-active-contract copy when contracts is empty', () => {
    renderTab({ contracts: [] });
    expect(screen.getByText(/No active contract/i)).toBeInTheDocument();
  });
});
