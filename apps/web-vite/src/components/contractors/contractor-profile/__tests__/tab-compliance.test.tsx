/**
 * web-vite port. Mocks tRPC-bound section containers and sub-components so
 * the compliance list test runs in isolation without a TRPCProvider.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : String(v)),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

vi.mock('../../country-compliance-section.js', () => ({
  CountryComplianceSectionContainer: () => <div data-testid="country-compliance" />,
}));

vi.mock('../../contractor-e-invoicing-section.js', () => ({
  ContractorEInvoicingSection: () => <div data-testid="e-invoicing" />,
}));

// ComplianceItemHistory calls useTRPC internally — stub it out.
vi.mock('../../compliance/compliance-item-history.js', () => ({
  ComplianceItemHistory: () => null,
}));

// Stub sub-components that open dialogs so this test stays presentational.
vi.mock('../../compliance/override-compliance-item-button.js', () => ({
  OverrideComplianceItemButton: ({ status }: { status: string }) => (
    <button type="button" data-testid={`override-btn-${status}`}>
      override
    </button>
  ),
}));

vi.mock('../../compliance/upload-review-dialog.js', () => ({
  UploadReviewDialogContainer: ({ documentId }: { documentId: string }) => (
    <div data-testid={`review-dialog-${documentId}`} />
  ),
}));

// Mutable can() — tests override per-call via the mock factory below.
let canReturn = true;
vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ can: () => canReturn }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import { TabCompliance } from '../tab-compliance.js';

const BASE_ITEM = {
  id: 'ci1',
  name: 'Right to Work',
  documentType: null,
  status: 'EXPIRED',
  dueDate: null,
  expiresAt: null,
  requirementTemplateId: null,
  severity: 'BLOCKING',
  waivedReasonCategory: null,
  pendingReviewDocumentId: null,
  contract: null,
} as const;

describe('TabCompliance', () => {
  it('renders both container sections when there are no compliance items', () => {
    canReturn = true;
    render(<TabCompliance contractor={{ id: 'c1', complianceItems: [] }} />);
    expect(screen.getByTestId('country-compliance')).toBeInTheDocument();
    expect(screen.getByTestId('e-invoicing')).toBeInTheDocument();
  });

  it('renders compliance items with names', () => {
    canReturn = true;
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            { ...BASE_ITEM, id: 'ci1', name: 'Insurance Certificate', status: 'SATISFIED' },
            { ...BASE_ITEM, id: 'ci2', name: 'NDA', status: 'MISSING' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Insurance Certificate')).toBeInTheDocument();
    expect(screen.getByText('NDA')).toBeInTheDocument();
  });

  it('renders an expiring item', () => {
    canReturn = true;
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            {
              ...BASE_ITEM,
              id: 'ci1',
              name: 'Expiring Doc',
              status: 'SATISFIED',
              expiresAt: soon.toISOString(),
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Expiring Doc')).toBeInTheDocument();
  });

  // Items with pendingReviewDocumentId show the review affordance.
  it('shows UploadReviewDialogContainer for items with a pendingReviewDocumentId', () => {
    canReturn = true;
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            { ...BASE_ITEM, id: 'ci1', name: 'Right to Work', pendingReviewDocumentId: 'doc-abc' },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('review-dialog-doc-abc')).toBeInTheDocument();
    // Override button must NOT appear for this item.
    expect(screen.queryByTestId('override-btn-EXPIRED')).not.toBeInTheDocument();
  });

  it('shows override button for items without a pendingReviewDocumentId', () => {
    canReturn = true;
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            {
              ...BASE_ITEM,
              id: 'ci1',
              name: 'NDA',
              status: 'EXPIRED',
              pendingReviewDocumentId: null,
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('override-btn-EXPIRED')).toBeInTheDocument();
    expect(screen.queryByTestId(/review-dialog/)).not.toBeInTheDocument();
  });

  it('does not show review button when user lacks compliance:override', () => {
    canReturn = false;
    render(
      <TabCompliance
        contractor={{
          id: 'c1',
          complianceItems: [
            { ...BASE_ITEM, id: 'ci1', name: 'Right to Work', pendingReviewDocumentId: 'doc-xyz' },
          ],
        }}
      />,
    );
    expect(screen.queryByTestId('review-dialog-doc-xyz')).not.toBeInTheDocument();
  });
});
