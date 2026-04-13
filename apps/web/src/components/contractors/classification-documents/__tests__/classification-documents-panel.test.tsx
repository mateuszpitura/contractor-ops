// Phase 59 Plan 59-02 Task 3 — ClassificationDocumentsPanel component tests.
// These are structural smoke tests: the panel renders, the disabled-state
// fallback engages when preconditions are not met, and accessibility anchors
// (aria-labelledby, aria-disabled) are present.

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

// Mock the child tRPC-bound components so we don't pull in the full tRPC client
// in unit tests. The panel's own contract — gating the CTA + wiring aria labels
// — is what we verify here.
vi.mock('../generate-sds-button', () => ({
  GenerateSdsButton: ({ classificationAssessmentId }: { classificationAssessmentId: string }) => (
    <button type="button" data-testid="generate-sds-btn" data-assessment={classificationAssessmentId}>
      Generate SDS
    </button>
  ),
}));

vi.mock('../document-history-list', () => ({
  DocumentHistoryList: ({ engagementId }: { engagementId: string }) => (
    <div data-testid="history-list" data-engagement={engagementId}>
      history
    </div>
  ),
}));

// Import AFTER mocks so the panel resolves against the mocked children.
import { ClassificationDocumentsPanel } from '../classification-documents-panel';

const messages = {
  Classification: {
    documents: {
      title: 'Classification documents',
      subtitle: 'Generate the legally required documents.',
      generateSds: 'Generate SDS',
      generateDisabled: 'Complete an IR35 assessment first.',
      generating: 'Generating…',
      documentHistory: 'Document history',
      emptyState: 'No documents generated yet.',
      download: 'Download',
      generatedOn: 'Generated on {date}',
      byteSize: '{kb} KB',
      toastSdsGenerated: 'SDS generated — opening download…',
      errorGenericTitle: 'Could not generate document',
      kindSds: 'SDS',
      kindDrvDefenseBundle: 'DRV defence bundle',
    },
  },
};

function renderPanel(props: {
  engagementId: string;
  countryCode: string | null;
  completedAssessmentId: string | null;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ClassificationDocumentsPanel {...props} />
    </NextIntlClientProvider>,
  );
}

describe('ClassificationDocumentsPanel', () => {
  it('renders the Generate SDS button when GB + completed assessment exists', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: 'ca_1',
    });
    expect(screen.getByTestId('generate-sds-btn')).toBeInTheDocument();
    expect(screen.getByTestId('generate-sds-btn').getAttribute('data-assessment')).toBe('ca_1');
  });

  it('renders disabled button with reason when engagement is not GB', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'DE',
      completedAssessmentId: 'ca_1',
    });
    expect(screen.queryByTestId('generate-sds-btn')).toBeNull();
    const button = screen.getByRole('button', { name: 'Generate SDS' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Complete an IR35 assessment first.')).toBeInTheDocument();
  });

  it('renders disabled button when no completed assessment exists (even for GB)', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: null,
    });
    expect(screen.queryByTestId('generate-sds-btn')).toBeNull();
    const button = screen.getByRole('button', { name: 'Generate SDS' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('exposes the panel as a labelled section (a11y anchor)', () => {
    renderPanel({
      engagementId: 'cass_1',
      countryCode: 'GB',
      completedAssessmentId: 'ca_1',
    });
    const heading = screen.getByRole('heading', { name: 'Classification documents' });
    expect(heading.id).toBe('classification-documents-heading');
  });

  it('always renders the DocumentHistoryList with the engagement id', () => {
    renderPanel({
      engagementId: 'cass_xyz',
      countryCode: 'GB',
      completedAssessmentId: null,
    });
    const list = screen.getByTestId('history-list');
    expect(list.getAttribute('data-engagement')).toBe('cass_xyz');
  });
});
