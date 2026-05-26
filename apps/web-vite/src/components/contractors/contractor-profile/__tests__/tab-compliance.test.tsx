/**
 * web-vite port. Mocks the two tRPC-bound section containers so the
 * compliance list test runs in isolation.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : String(v)),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

vi.mock('../../country-compliance-section-container.js', () => ({
  CountryComplianceSectionContainer: () => <div data-testid="country-compliance" />,
}));

vi.mock('../../contractor-e-invoicing-section-container.js', () => ({
  ContractorEInvoicingSectionContainer: () => <div data-testid="e-invoicing" />,
}));

import { render, screen } from '../../../../test/test-utils.js';
import { TabCompliance } from '../tab-compliance.js';

describe('TabCompliance', () => {
  it('renders both container sections when there are no compliance items', () => {
    render(<TabCompliance contractor={{ id: 'c1', complianceItems: [] }} />);
    expect(screen.getByTestId('country-compliance')).toBeInTheDocument();
    expect(screen.getByTestId('e-invoicing')).toBeInTheDocument();
  });

  it('renders compliance items with names', () => {
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            {
              id: 'ci1',
              name: 'Insurance Certificate',
              documentType: 'PDF',
              status: 'SATISFIED',
              dueDate: null,
              expiresAt: null,
              requirementTemplateId: null,
              contract: null,
            },
            {
              id: 'ci2',
              name: 'NDA',
              documentType: null,
              status: 'MISSING',
              dueDate: null,
              expiresAt: null,
              requirementTemplateId: null,
              contract: null,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Insurance Certificate')).toBeInTheDocument();
    expect(screen.getByText('NDA')).toBeInTheDocument();
  });

  it('renders an expiring item', () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            {
              id: 'ci1',
              name: 'Expiring Doc',
              documentType: null,
              status: 'SATISFIED',
              dueDate: null,
              expiresAt: soon.toISOString(),
              requirementTemplateId: null,
              contract: null,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Expiring Doc')).toBeInTheDocument();
  });
});
